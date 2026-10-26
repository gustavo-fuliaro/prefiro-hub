"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconeArquivar, IconeBusca, IconeCalendario, IconeCheck, IconeComentario, IconeLapis, IconeMais, IconeRelogio, IconeRestaurar,
} from "@/components/icones";
import { aoVivo as aoVivoCanal, atualizarTarefa } from "@/lib/tarefas-api";
import {
  colunaDe, COLUNAS, dataCurta, estaAtrasada, estaConcluida, FILTROS_PADRAO, filtrar, ordemEntre, ordenar, STATUS_LABEL, STATUS_ORDEM,
  statusAoSoltar, type ColunaId, type Filtros, type Ordenacao, type Status, type Tarefa,
} from "@/lib/tarefas";
import { useAcoesTarefa } from "./acoes";
import { DetalhesTarefa } from "./detalhes";
import { TarefaForm } from "./tarefa-form";
import { botao, botaoPrimario, campo, ChipStatus, type Contexto, Iniciais, MenuAcoes } from "./ui";

type Alvo = { coluna: ColunaId; indice: number };

export function Quadro({
  ctx,
  iniciais,
  comentarios,
  abrir,
}: {
  ctx: Contexto;
  iniciais: Tarefa[];
  comentarios: { id: number; tarefa_id: number }[];
  abrir: number | null;
}) {
  const [tarefas, setTarefas] = useState<Map<number, Tarefa>>(() => new Map(iniciais.map((t) => [t.id, t])));
  const [coments, setComents] = useState<Map<number, number>>(() => new Map(comentarios.map((c) => [c.id, c.tarefa_id])));
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_PADRAO);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("manual");
  const [detalhe, setDetalhe] = useState<number | null>(abrir);
  const [nova, setNova] = useState<Status | null>(null);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aoVivo, setAoVivo] = useState(false);

  // Guarda a versão atual para os eventos ao vivo não sobrescreverem uma edição mais nova.
  const aplicar = (t: Tarefa) =>
    setTarefas((m) => {
      const atual = m.get(t.id);
      if (atual && atual.atualizado_em > t.atualizado_em) return m;
      const novo = new Map(m);
      if (t.arquivada_em) novo.delete(t.id);
      else novo.set(t.id, t);
      return novo;
    });
  const remover = (id: number) =>
    setTarefas((m) => {
      if (!m.has(id)) return m;
      const novo = new Map(m);
      novo.delete(id);
      return novo;
    });

  // Tempo real: o quadro de todos do ambiente acompanha criações, movimentos e exclusões.
  useEffect(() => {
    return aoVivoCanal(`quadro-${ctx.contaId}`, (c) => c
      .on("postgres_changes", { event: "*", schema: "hub", table: "tarefas", filter: `conta_id=eq.${ctx.contaId}` }, (p) => {
        if (p.eventType === "DELETE") remover((p.old as { id: number }).id);
        else aplicar(p.new as Tarefa);
      })
      .on("postgres_changes", { event: "INSERT", schema: "hub", table: "tarefa_comentarios" }, (p) => {
        const c = p.new as { id: number; tarefa_id: number };
        setComents((m) => new Map(m).set(c.id, c.tarefa_id));
      })
      .on("postgres_changes", { event: "DELETE", schema: "hub", table: "tarefa_comentarios" }, (p) => {
        const id = (p.old as { id: number }).id;
        setComents((m) => {
          if (!m.has(id)) return m;
          const novo = new Map(m);
          novo.delete(id);
          return novo;
        });
      })
    , setAoVivo);
  }, [ctx.contaId]);

  const acoes = useAcoesTarefa(ctx, aplicar, remover);

  const lista = useMemo(() => [...tarefas.values()], [tarefas]);
  const visiveis = useMemo(() => ordenar(filtrar(lista, filtros, ctx.hoje), ordenacao), [lista, filtros, ordenacao, ctx.hoje]);
  const porColuna = useMemo(() => {
    const g = Object.fromEntries(COLUNAS.map((c) => [c.id, [] as Tarefa[]])) as Record<ColunaId, Tarefa[]>;
    for (const t of visiveis) g[colunaDe(t.status)].push(t);
    return g;
  }, [visiveis]);
  const qtdComentarios = useMemo(() => {
    const n = new Map<number, number>();
    for (const tid of coments.values()) n.set(tid, (n.get(tid) ?? 0) + 1);
    return n;
  }, [coments]);
  const atrasadas = lista.filter((t) => estaAtrasada(t, ctx.hoje)).length;
  const filtrando = JSON.stringify(filtros) !== JSON.stringify(FILTROS_PADRAO);

  function abrirDetalhe(id: number | null) {
    setDetalhe(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("tarefa", String(id));
    else url.searchParams.delete("tarefa");
    window.history.replaceState(null, "", url);
  }

  async function soltar(coluna: ColunaId, indice: number) {
    const id = arrastando;
    setArrastando(null);
    setAlvo(null);
    const t = id ? tarefas.get(id) : undefined;
    if (!t || !ctx.podeEditar) return;
    const vizinhos = porColuna[coluna].filter((x) => x.id !== t.id);
    const status = statusAoSoltar(coluna, t.status);
    let ordem = t.ordem;
    if (ordenacao === "manual") ordem = ordemEntre(vizinhos[indice - 1]?.ordem, vizinhos[indice]?.ordem);
    else if (colunaDe(t.status) !== coluna) ordem = ordemEntre(Math.max(0, ...vizinhos.map((v) => v.ordem)), undefined);
    if (status === t.status && ordem === t.ordem) return;

    const antes = t;
    setTarefas((m) => new Map(m).set(t.id, { ...t, status, ordem }));
    setErro(null);
    const r = await atualizarTarefa(t.id, status === t.status ? { ordem } : { status, ordem });
    if (r.erro) {
      setErro(r.erro);
      setTarefas((m) => new Map(m).set(antes.id, antes));
    } else aplicar(r.ok!);
  }

  return (
    <div className="grid gap-4">
      <Barra
        ctx={ctx}
        filtros={filtros}
        setFiltros={setFiltros}
        ordenacao={ordenacao}
        setOrdenacao={setOrdenacao}
        atrasadas={atrasadas}
        filtrando={filtrando}
        aoNova={() => setNova("roteirizacao")}
      />

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite" className="text-muted">
          {visiveis.length} {visiveis.length === 1 ? "tarefa" : "tarefas"}
          {filtrando ? ` de ${lista.length}` : visiveis.length === 1 ? " ativa" : " ativas"}
          {atrasadas > 0 && <span className="text-danger"> · {atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}</span>}
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted" title={aoVivo ? "Mudanças da equipe aparecem na hora" : "Conectando…"}>
          <span aria-hidden className={`size-2 rounded-full ${aoVivo ? "bg-ok" : "bg-line-strong"}`} />
          {aoVivo ? "Ao vivo" : "Conectando"}
        </span>
      </div>
      {(erro || acoes.erro) && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-2 text-sm text-danger">{erro ?? acoes.erro}</p>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        <div className="grid min-w-max auto-cols-[minmax(264px,1fr)] grid-flow-col gap-3 xl:min-w-0">
          {COLUNAS.map((c) => {
            const itens = porColuna[c.id];
            const agend = c.id === "final" ? itens.filter((t) => t.status === "agendado").length : 0;
            return (
              <section
                key={c.id}
                aria-labelledby={`coluna-${c.id}`}
                onDragOver={(e) => {
                  if (arrastando === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const cartoes = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-cartao]")].filter((el) => el.dataset.cartao !== String(arrastando));
                  const i = cartoes.findIndex((el) => {
                    const r = el.getBoundingClientRect();
                    return e.clientY < r.top + r.height / 2;
                  });
                  const indice = i === -1 ? cartoes.length : i;
                  if (alvo?.coluna !== c.id || alvo.indice !== indice) setAlvo({ coluna: c.id, indice });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvo((a) => (a?.coluna === c.id ? null : a));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  soltar(c.id, alvo?.coluna === c.id ? alvo.indice : itens.length);
                }}
                className={`grid content-start gap-2 rounded-balao bg-lane p-2 transition-colors ${alvo?.coluna === c.id ? "outline-2 outline-accent/60 outline-dashed" : ""}`}
              >
                <header className="flex items-center justify-between gap-2 px-1.5 pt-1">
                  <h2 id={`coluna-${c.id}`} className="font-display text-sm font-bold">
                    {c.titulo} <span className="font-sans font-normal text-muted">{itens.length}</span>
                  </h2>
                  {ctx.podeEditar && (
                    <button
                      type="button"
                      onClick={() => setNova(c.id === "final" ? "agendado" : c.id)}
                      aria-label={`Nova tarefa em ${c.titulo}`}
                      className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink"
                    >
                      <IconeMais />
                    </button>
                  )}
                </header>
                {c.id === "final" && itens.length > 0 && (
                  <p className="px-1.5 text-xs text-muted">{agend} agendada{agend === 1 ? "" : "s"} · {itens.length - agend} publicada{itens.length - agend === 1 ? "" : "s"}</p>
                )}
                <ul className="grid min-h-16 gap-2">
                  {itens.map((t, i) => (
                    <li key={t.id} className="grid gap-2">
                      {alvo?.coluna === c.id && alvo.indice === i && arrastando !== t.id && <Marcador />}
                      <Cartao
                        t={t}
                        ctx={ctx}
                        comentarios={qtdComentarios.get(t.id) ?? 0}
                        arrastando={arrastando === t.id}
                        aoArrastar={() => setArrastando(t.id)}
                        aoSoltar={() => {
                          setArrastando(null);
                          setAlvo(null);
                        }}
                        aoAbrir={() => abrirDetalhe(t.id)}
                        acoes={acoes}
                      />
                    </li>
                  ))}
                  {alvo?.coluna === c.id && alvo.indice >= itens.filter((t) => t.id !== arrastando).length && (
                    <li aria-hidden>
                      <Marcador />
                    </li>
                  )}
                  {itens.length === 0 && !alvo && (
                    <li className="rounded-balao-sm border border-dashed border-line-strong px-3 py-5 text-center text-xs text-muted">
                      {filtrando ? "Nada com estes filtros" : "Nenhuma tarefa aqui"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {nova && (
        <TarefaForm
          ctx={ctx}
          statusInicial={nova}
          ordem={ordemEntre(undefined, porColuna[colunaDe(nova)][0]?.ordem)}
          aoFechar={() => setNova(null)}
          aoSalvar={(t) => {
            aplicar(t);
            setNova(null);
          }}
        />
      )}
      {detalhe !== null && (
        <DetalhesTarefa
          key={detalhe}
          ctx={ctx}
          tarefaId={detalhe}
          tarefa={tarefas.get(detalhe)}
          aoMudar={aplicar}
          aoRemover={remover}
          aoFechar={() => abrirDetalhe(null)}
        />
      )}
      {acoes.dialogos}
    </div>
  );
}

function Marcador() {
  return <div aria-hidden className="h-1 rounded-full bg-accent" />;
}

function Cartao({
  t, ctx, comentarios, arrastando, aoArrastar, aoSoltar, aoAbrir, acoes,
}: {
  t: Tarefa;
  ctx: Contexto;
  comentarios: number;
  arrastando: boolean;
  aoArrastar: () => void;
  aoSoltar: () => void;
  aoAbrir: () => void;
  acoes: ReturnType<typeof useAcoesTarefa>;
}) {
  const atrasada = estaAtrasada(t, ctx.hoje);
  const concluida = estaConcluida(t);
  const nome = t.responsavel ? ctx.membros.find((m) => m.user_id === t.responsavel)?.nome : null;
  const arrastou = useRef(false);
  const estado = concluida
    ? "border-ok/45 bg-ok-soft"
    : atrasada
      ? "border-danger/45 bg-danger-soft"
      : "border-line bg-surface hover:border-line-strong";

  return (
    <article
      data-cartao={t.id}
      data-arrastando={arrastando || undefined}
      draggable={ctx.podeEditar}
      onDragStart={(e) => {
        arrastou.current = true;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(t.id));
        aoArrastar();
      }}
      onDragEnd={() => {
        aoSoltar();
        setTimeout(() => (arrastou.current = false), 0);
      }}
      className={`cartao-tarefa group relative grid gap-2 rounded-balao-sm border p-3 shadow-card transition-[border-color,box-shadow] ${estado} ${ctx.podeEditar ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-sm leading-snug font-semibold">
          <button
            type="button"
            onClick={() => !arrastou.current && aoAbrir()}
            className="line-clamp-3 text-left break-words after:absolute after:inset-0 after:rounded-balao-sm focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"
          >
            {t.titulo}
          </button>
        </h3>
        <div className="relative z-10 -mt-1 -mr-1 flex items-center">
          {ctx.podeEditar && (
            <div className="acoes-rapidas flex items-center">
              {concluida ? (
                <AcaoRapida rotulo="Reabrir" onClick={() => acoes.reabrir(t)}><IconeRestaurar className="size-3.5" /></AcaoRapida>
              ) : (
                <AcaoRapida rotulo={t.status === "agendado" ? "Marcar como publicado" : "Concluir"} onClick={() => acoes.concluir(t)}>
                  <IconeCheck className="size-3.5" />
                </AcaoRapida>
              )}
              <AcaoRapida rotulo="Editar" onClick={() => acoes.editar(t)}><IconeLapis className="size-3.5" /></AcaoRapida>
              <AcaoRapida rotulo="Arquivar" onClick={() => acoes.arquivar(t)}><IconeArquivar className="size-3.5" /></AcaoRapida>
            </div>
          )}
          <MenuAcoes rotulo={`Ações de ${t.titulo}`} itens={acoes.itensMenu(t, { abrir: aoAbrir })} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        <ChipStatus status={t.status} />
        {atrasada && <span className="font-semibold text-danger">Atrasada</span>}
        {concluida && t.concluida_em && (
          <span className="flex items-center gap-1 font-semibold text-ok">
            <IconeCheck className="size-3.5" />
            {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: ctx.fuso }).format(new Date(t.concluida_em))}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        {nome ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Iniciais nome={nome} className="size-5 text-[10px]" />
            <span className="truncate">{nome.split(" ")[0]}</span>
          </span>
        ) : (
          <span>Sem responsável</span>
        )}
        {t.vencimento && (
          <span className={`flex items-center gap-1 ${atrasada ? "font-semibold text-danger" : ""}`} title="Data da tarefa">
            <IconeRelogio className="size-3.5" />
            {dataCurta(t.vencimento)}
          </span>
        )}
        {t.data_publicacao && (
          <span className="flex items-center gap-1" title="Data da publicação">
            <IconeCalendario className="size-3.5" />
            {dataCurta(t.data_publicacao)}
          </span>
        )}
        {comentarios > 0 && (
          <span className="flex items-center gap-1" title={`${comentarios} comentário${comentarios === 1 ? "" : "s"}`}>
            <IconeComentario className="size-3.5" />
            {comentarios}
          </span>
        )}
      </div>
    </article>
  );
}

function AcaoRapida({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid size-7 place-items-center rounded-md text-muted hover:bg-lane hover:text-ink"
    >
      {children}
    </button>
  );
}

function Barra({
  ctx, filtros, setFiltros, ordenacao, setOrdenacao, atrasadas, filtrando, aoNova,
}: {
  ctx: Contexto;
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  ordenacao: Ordenacao;
  setOrdenacao: (o: Ordenacao) => void;
  atrasadas: number;
  filtrando: boolean;
  aoNova: () => void;
}) {
  const muda = (p: Partial<Filtros>) => setFiltros({ ...filtros, ...p });
  const pequeno = "h-9 rounded-md border border-line bg-surface px-2.5 text-sm";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar tarefa</span>
          <IconeBusca className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => muda({ busca: e.target.value })}
            placeholder="Buscar pelo nome"
            className={`${campo} bg-surface pl-9`}
          />
        </label>
        <Link href="/planejador/arquivados" className={`${botao} h-10 border border-line bg-surface hover:border-accent`}>
          <IconeArquivar /> Arquivados
        </Link>
        {ctx.podeEditar && (
          <button type="button" onClick={aoNova} className={botaoPrimario}>
            <IconeMais /> Nova tarefa
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filtrar por responsável" value={filtros.responsavel} onChange={(e) => muda({ responsavel: e.target.value })} className={pequeno}>
          <option value="todos">Todos os responsáveis</option>
          <option value="sem">Sem responsável</option>
          {ctx.membros.map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.nome}</option>
          ))}
        </select>
        <select aria-label="Filtrar por status" value={filtros.status} onChange={(e) => muda({ status: e.target.value as Filtros["status"] })} className={pequeno}>
          <option value="todos">Todos os status</option>
          {STATUS_ORDEM.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={filtros.atrasadas}
          onClick={() => muda({ atrasadas: !filtros.atrasadas })}
          className={`${pequeno} font-medium ${filtros.atrasadas ? "border-danger bg-danger-soft text-danger" : ""}`}
        >
          Atrasadas{atrasadas > 0 ? ` (${atrasadas})` : ""}
        </button>
        <fieldset className="flex items-center gap-1.5 text-sm text-muted">
          <legend className="sr-only">Período (data da tarefa ou da publicação)</legend>
          <span aria-hidden>Período</span>
          <input type="date" aria-label="De" value={filtros.de} onChange={(e) => muda({ de: e.target.value })} className={pequeno} />
          <span aria-hidden>a</span>
          <input type="date" aria-label="Até" value={filtros.ate} onChange={(e) => muda({ ate: e.target.value })} className={pequeno} />
        </fieldset>
        <select aria-label="Ordenar" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as Ordenacao)} className={pequeno}>
          <option value="manual">Ordem do quadro</option>
          <option value="vencimento">Data da tarefa</option>
          <option value="criacao">Mais recentes</option>
        </select>
        {filtrando && (
          <button type="button" onClick={() => setFiltros(FILTROS_PADRAO)} className="text-sm font-medium text-accent-strong hover:underline">
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
