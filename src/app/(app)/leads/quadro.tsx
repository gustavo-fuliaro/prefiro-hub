"use client";

import { useMemo, useState } from "react";
import { Dialogo } from "@/components/dialogo";
import { IconeBusca, IconeMais } from "@/components/icones";
import {
  colunasDoQuadro, filtrarLeads, formatarDuracao, FILTROS_LEAD_PADRAO, lerHandleLead, ordenarLeads, podeAssumir, podeMexer, PRIORIDADE_LABEL,
  validarEmailLead, type FiltrosLead, type Lead, type Prioridade,
} from "@/lib/leads";
import { assumirLead, criarLead, lerLead } from "@/lib/leads-api";
import { doPerfil, perfilPadrao } from "@/lib/perfis-proprios";
import { supabaseNavegador } from "@/lib/tarefas-api";
import { botao, botaoPrimario, campo, Iniciais } from "../planejador/ui";
import { ChipPrazo, ChipPrioridade, type Ctx, EtiquetaPerfilLead, inicioDoDia, useAgora, useLeadsAoVivo, useMoverLead, useNomes } from "./comum";
import { DetalhesLead } from "./detalhes";

export function QuadroLeads({ ctx, iniciais, abrir }: { ctx: Ctx; iniciais: Lead[]; abrir: number | null }) {
  const { leads, aplicar, remover, conectado } = useLeadsAoVivo(ctx, iniciais);
  const [filtros, setFiltros] = useState<FiltrosLead>(FILTROS_LEAD_PADRAO);
  const [detalhe, setDetalhe] = useState<number | null>(abrir);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const agora = useAgora();
  const nomes = useNomes(ctx);
  const { mover, dialogo } = useMoverLead(aplicar);

  const colunas = useMemo(() => colunasDoQuadro(ctx.etapas), [ctx.etapas]);
  const doQuadro = useMemo(() => {
    const ids = new Set(colunas.map((c) => c.id));
    return doPerfil([...leads.values()].filter((l) => l.pipeline_id === ctx.pipeline.id && ids.has(l.etapa_id)), ctx.perfilAtual);
  }, [leads, colunas, ctx.pipeline.id, ctx.perfilAtual]);
  const visiveis = useMemo(
    () => ordenarLeads(filtrarLeads(doQuadro, filtros, { eu: ctx.eu, hojeInicio: inicioDoDia(ctx.hoje, ctx.fuso) })),
    [doQuadro, filtros, ctx.eu, ctx.hoje, ctx.fuso],
  );
  const filtrando = JSON.stringify(filtros) !== JSON.stringify(FILTROS_LEAD_PADRAO);

  function abrirDetalhe(id: number | null) {
    setDetalhe(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("lead", String(id));
    else url.searchParams.delete("lead");
    window.history.replaceState(null, "", url);
  }

  async function soltar(etapaId: number) {
    const l = arrastando ? leads.get(arrastando) : undefined;
    setArrastando(null);
    setAlvo(null);
    const etapa = ctx.etapas.find((e) => e.id === etapaId);
    if (!l || !etapa || !podeMexer(l, ctx.perm)) return;
    setErro(await mover(l, etapa));
  }

  return (
    <div className="grid gap-4">
      {ctx.perm.trabalha && (
        <ColarLead
          ctx={ctx}
          aoCriar={(l) => {
            aplicar(l);
            setErro(null);
          }}
          aoErro={setErro}
          aoAbrirExistente={(id) => abrirDetalhe(id)}
          aoNovo={() => setNovo(true)}
        />
      )}
      <Filtros ctx={ctx} filtros={filtros} setFiltros={setFiltros} filtrando={filtrando} />

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite" className="text-muted">
          {visiveis.length} {visiveis.length === 1 ? "lead" : "leads"}
          {filtrando ? ` de ${doQuadro.length}` : " no quadro"}
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className={`size-2 rounded-full ${conectado ? "bg-ok" : "bg-line-strong"}`} />
          {conectado ? "Ao vivo" : "Conectando"}
        </span>
      </div>
      {erro && <p role="alert" className="rounded-md bg-danger-soft px-4 py-2 text-sm text-danger">{erro}</p>}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        <div className="grid min-w-max auto-cols-[minmax(250px,1fr)] grid-flow-col gap-3 xl:min-w-0">
          {colunas.map((c) => {
            const itens = visiveis.filter((l) => l.etapa_id === c.id);
            return (
              <section
                key={c.id}
                aria-labelledby={`etapa-${c.id}`}
                onDragOver={(e) => {
                  if (arrastando === null) return;
                  e.preventDefault();
                  if (alvo !== c.id) setAlvo(c.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setAlvo((a) => (a === c.id ? null : a));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  soltar(c.id);
                }}
                className={`grid content-start gap-2 rounded-balao bg-lane p-2 transition-colors ${alvo === c.id ? "outline-2 outline-accent/60 outline-dashed" : ""}`}
              >
                <header className="grid gap-0.5 px-1.5 pt-1">
                  <h2 id={`etapa-${c.id}`} className="flex items-center gap-2 font-display text-sm font-bold">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: c.cor }} />
                    {c.nome} <span className="font-sans font-normal text-muted">{itens.length}</span>
                  </h2>
                  <p className="text-[11px] text-muted">
                    {c.papel === "meta" ? "Meta · " : ""}
                    {c.prazo_h === null ? "sem prazo" : c.papel === "futuro" ? `${formatarDuracao(c.prazo_h)} após a data de retorno` : `prazo de ${formatarDuracao(c.prazo_h)}`}
                  </p>
                </header>
                <ul className="grid min-h-16 gap-2">
                  {itens.map((l) => (
                    <li key={l.id}>
                      <CartaoLead
                        ctx={ctx}
                        l={l}
                        agora={agora}
                        responsavel={l.responsavel ? (nomes.get(l.responsavel) ?? "Pessoa removida") : null}
                        arrastavel={podeMexer(l, ctx.perm)}
                        aoArrastar={() => setArrastando(l.id)}
                        aoSoltar={() => {
                          setArrastando(null);
                          setAlvo(null);
                        }}
                        aoAbrir={() => abrirDetalhe(l.id)}
                        aoAssumir={async () => {
                          const r = await assumirLead(l.id);
                          setErro(r.erro ?? null);
                          const novo = await lerLead(l.id);
                          if (novo.ok) aplicar(novo.ok);
                        }}
                      />
                    </li>
                  ))}
                  {itens.length === 0 && (
                    <li className="rounded-balao-sm border border-dashed border-line-strong px-3 py-5 text-center text-xs text-muted">
                      {filtrando ? "Nada com estes filtros" : "Nenhum lead aqui"}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      {novo && (
        <NovoLead
          ctx={ctx}
          aoFechar={() => setNovo(false)}
          aoCriar={(l) => {
            aplicar(l);
            setNovo(false);
          }}
        />
      )}
      {detalhe !== null && (
        <DetalhesLead key={detalhe} ctx={ctx} leadId={detalhe} lead={leads.get(detalhe)} aoMudar={aplicar} aoRemover={remover} aoFechar={() => abrirDetalhe(null)} />
      )}
      {dialogo}
    </div>
  );
}

export function CartaoLead({
  ctx, l, agora, responsavel, arrastavel, aoArrastar, aoSoltar, aoAbrir, aoAssumir,
}: {
  ctx: Ctx;
  l: Lead;
  agora: number;
  responsavel: string | null;
  arrastavel: boolean;
  aoArrastar?: () => void;
  aoSoltar?: () => void;
  aoAbrir: () => void;
  aoAssumir: () => void;
}) {
  const etapa = ctx.etapas.find((e) => e.id === l.etapa_id) ?? null;
  return (
    <article
      draggable={arrastavel && !!aoArrastar}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(l.id));
        aoArrastar?.();
      }}
      onDragEnd={() => aoSoltar?.()}
      className={`relative grid gap-2 rounded-balao-sm border border-line bg-surface p-3 shadow-card hover:border-line-strong ${arrastavel && aoArrastar ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <h3 className="min-w-0 text-sm leading-snug font-semibold">
        <button type="button" onClick={aoAbrir} className="block max-w-full truncate text-left after:absolute after:inset-0 after:rounded-balao-sm focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent">
          @{l.handle}
        </button>
      </h3>
      {l.nome && <p className="-mt-1.5 truncate text-xs text-muted">{l.nome}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        {ctx.perfilAtual === null && ctx.perfis.length > 0 && <EtiquetaPerfilLead ctx={ctx} perfilId={l.perfil_id} />}
        <ChipPrioridade p={l.prioridade} />
        <ChipPrazo expiraEm={l.expira_em} agora={agora} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        {responsavel ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Iniciais nome={responsavel} className="size-5 text-[10px]" />
            <span className="truncate">{responsavel.split(" ")[0]}</span>
          </span>
        ) : (
          <span>Sem responsável</span>
        )}
        {podeAssumir(l, etapa, ctx.perm) && (
          <button type="button" onClick={(e) => { e.stopPropagation(); aoAssumir(); }} className="relative z-10 rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-ink">
            Assumir
          </button>
        )}
      </div>
    </article>
  );
}

function ColarLead({
  ctx, aoCriar, aoErro, aoAbrirExistente, aoNovo,
}: {
  ctx: Ctx;
  aoCriar: (l: Lead) => void;
  aoErro: (t: string | null) => void;
  aoAbrirExistente: (id: number) => void;
  aoNovo: () => void;
}) {
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const handle = lerHandleLead(valor);
        if (!handle) return aoErro("Cole o link do perfil no Instagram ou o @ (letras, números, ponto e _).");
        setSalvando(true);
        const r = await criarLead({ handle, perfil_id: perfilPadrao(ctx.perfis, ctx.perfilAtual), pipeline_id: ctx.pipeline.id });
        setSalvando(false);
        if (r.erro) {
          aoErro(r.erro);
          // Já cadastrado: abre o lead que existe.
          if (/já está cadastrado/.test(r.erro)) {
            const { data } = await supabaseNavegador().from("leads").select("id").eq("handle", handle).maybeSingle<{ id: number }>();
            if (data) aoAbrirExistente(data.id);
          }
          return;
        }
        setValor("");
        aoCriar(r.ok!);
      }}
    >
      <label className="relative min-w-56 flex-1">
        <span className="sr-only">Link do Instagram ou @ do lead</span>
        <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Cole o link do Instagram ou o @handle" className={`${campo} bg-surface`} />
      </label>
      <button type="submit" disabled={salvando || !valor.trim()} className={botaoPrimario}>{salvando ? "Salvando…" : "Colar lead"}</button>
      <button type="button" onClick={aoNovo} className={`${botao} h-10 border border-line bg-surface hover:border-accent`} aria-label="Cadastrar lead com mais dados">
        <IconeMais /> Com dados
      </button>
    </form>
  );
}

function Filtros({ ctx, filtros, setFiltros, filtrando }: { ctx: Ctx; filtros: FiltrosLead; setFiltros: (f: FiltrosLead) => void; filtrando: boolean }) {
  const muda = (p: Partial<FiltrosLead>) => setFiltros({ ...filtros, ...p });
  const pequeno = "h-9 rounded-md border border-line bg-surface px-2.5 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-48 flex-1">
        <span className="sr-only">Buscar lead</span>
        <IconeBusca className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <input type="search" value={filtros.busca} onChange={(e) => muda({ busca: e.target.value })} placeholder="Buscar @ ou nome" className={`${pequeno} w-full pl-9`} />
      </label>
      <select aria-label="Filtrar por responsável" value={filtros.responsavel} onChange={(e) => muda({ responsavel: e.target.value })} className={pequeno}>
        <option value="todos">Todos os responsáveis</option>
        <option value="meus">Meus leads</option>
        <option value="sem">Sem responsável</option>
        {ctx.membros.map((m) => (
          <option key={m.user_id} value={m.user_id}>{m.nome}</option>
        ))}
      </select>
      <select aria-label="Filtrar por prioridade" value={filtros.prioridade} onChange={(e) => muda({ prioridade: e.target.value as FiltrosLead["prioridade"] })} className={pequeno}>
        <option value="todas">Toda prioridade</option>
        {(["alta", "normal", "baixa"] as Prioridade[]).map((p) => (
          <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
        ))}
      </select>
      <select aria-label="Filtrar por entrada" value={filtros.periodo} onChange={(e) => muda({ periodo: e.target.value as FiltrosLead["periodo"] })} className={pequeno}>
        <option value="todos">Qualquer entrada</option>
        <option value="hoje">Entrou hoje</option>
        <option value="7d">Últimos 7 dias</option>
        <option value="30d">Últimos 30 dias</option>
      </select>
      {filtrando && (
        <button type="button" onClick={() => setFiltros(FILTROS_LEAD_PADRAO)} className="text-sm font-medium text-accent-strong hover:underline">Limpar filtros</button>
      )}
    </div>
  );
}

function NovoLead({ ctx, aoFechar, aoCriar }: { ctx: Ctx; aoFechar: () => void; aoCriar: (l: Lead) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  return (
    <Dialogo titulo="Novo lead" aoFechar={aoFechar} descricao="Só o @ é obrigatório. Ele entra na primeira coluna, com você como responsável.">
      <form
        className="grid gap-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const handle = lerHandleLead(String(fd.get("handle") ?? ""));
          if (!handle) return setErro("Informe o link do Instagram ou o @ do lead.");
          const email = String(fd.get("email") ?? "").trim();
          if (email && !validarEmailLead(email)) return setErro("Confira o e-mail.");
          setSalvando(true);
          const r = await criarLead({
            handle,
            pipeline_id: ctx.pipeline.id,
            nome: String(fd.get("nome") ?? "").trim() || null,
            telefone: String(fd.get("telefone") ?? "").trim() || null,
            email: email || null,
            prioridade: fd.get("prioridade") as Prioridade,
            perfil_id: Number(fd.get("perfil_id")) || null,
            observacao: String(fd.get("observacao") ?? "").trim() || null,
          });
          setSalvando(false);
          if (r.erro) return setErro(r.erro);
          aoCriar(r.ok!);
        }}
      >
        <label className="grid gap-1 text-sm font-medium">
          Link do Instagram ou @
          <input name="handle" required autoFocus className={campo} placeholder="instagram.com/fulano ou @fulano" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Nome
            <input name="nome" maxLength={120} className={campo} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Telefone
            <input name="telefone" type="tel" maxLength={30} className={campo} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            E-mail
            <input name="email" type="email" className={campo} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Prioridade
            <select name="prioridade" defaultValue="normal" className={campo}>
              {(["alta", "normal", "baixa"] as Prioridade[]).map((p) => (
                <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
              ))}
            </select>
          </label>
          {ctx.perfis.length > 0 && (
            <label className="grid gap-1 text-sm font-medium">
              Veio pelo perfil
              <select name="perfil_id" defaultValue={String(perfilPadrao(ctx.perfis, ctx.perfilAtual) ?? "")} className={campo}>
                <option value="">Nenhum</option>
                {ctx.perfis.map((p) => (
                  <option key={p.id} value={p.id}>@{p.handle}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Observação
          <textarea name="observacao" maxLength={2000} rows={3} className="rounded-md border border-line bg-bg px-3 py-2 font-normal" />
        </label>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className={`${botao} border border-line`}>Cancelar</button>
          <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? "Salvando…" : "Cadastrar lead"}</button>
        </div>
      </form>
    </Dialogo>
  );
}
