"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconeArroba, IconeCalendario, IconeFechar, IconeLink, IconeLixeira, IconePessoa, IconeRelogio } from "@/components/icones";
import { LinhasCarregando } from "@/components/marca";
import {
  aoVivo, apagarComentario, comentar, lerComentarios, lerEventos, lerTarefa, type Comentario,
} from "@/lib/tarefas-api";
import { perfilPorId } from "@/lib/perfis-proprios";
import { dataCurta, descreverEvento, estaAtrasada, estaConcluida, type Evento, type Tarefa } from "@/lib/tarefas";
import { useAcoesTarefa } from "./acoes";
import { botao, ChipStatus, type Contexto, Iniciais, MenuAcoes } from "./ui";

// Painel lateral com tudo da tarefa: campos, links, comentários (ao vivo) e histórico.
export function DetalhesTarefa({
  ctx,
  tarefaId,
  tarefa: tarefaPai,
  aoMudar,
  aoRemover,
  aoFechar,
}: {
  ctx: Contexto;
  tarefaId: number;
  tarefa?: Tarefa;
  aoMudar: (t: Tarefa) => void;
  aoRemover: (id: number) => void;
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [carregada, setCarregada] = useState<Tarefa | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const tarefa = tarefaPai ?? carregada;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Aberta por link (notificação, calendário, arquivados): busca no banco, respeitando o ambiente.
  useEffect(() => {
    if (tarefaPai) return;
    let vivo = true;
    lerTarefa(tarefaId).then((r) => {
      if (!vivo) return;
      if (r.erro) setErroCarga(r.erro);
      else setCarregada(r.ok!);
    });
    return () => {
      vivo = false;
    };
  }, [tarefaId, tarefaPai]);

  const mudou = (t: Tarefa) => {
    setCarregada(t);
    aoMudar(t);
  };
  const acoes = useAcoesTarefa(ctx, mudou, (id) => {
    aoRemover(id);
    ref.current?.close();
  });
  const nomes = useMemo(() => new Map(ctx.membros.map((m) => [m.user_id, m.nome])), [ctx.membros]);
  const quando = useMemo(
    () => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: ctx.fuso }),
    [ctx.fuso],
  );

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      aria-labelledby="detalhes-titulo"
      className="gaveta w-[min(520px,100vw)] border-l border-line bg-surface p-0 text-ink"
    >
      {!tarefa ? (
        <div className="grid h-full place-items-center p-6 text-muted">
          {erroCarga ? (
            <div className="grid gap-3 text-center">
              <p role="alert">{erroCarga}</p>
              <button type="button" onClick={() => ref.current?.close()} className={`${botao} justify-center border border-line`}>Fechar</button>
            </div>
          ) : (
            <LinhasCarregando rotulo="Carregando tarefa" />
          )}
        </div>
      ) : (
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
          <header className="grid gap-3 border-b border-line p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="detalhes-titulo" className="font-display text-xl leading-snug font-bold break-words">{tarefa.titulo}</h2>
              <div className="flex shrink-0 items-center gap-1">
                <MenuAcoes rotulo="Mais ações da tarefa" itens={acoes.itensMenu(tarefa)} />
                <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="grid size-9 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink">
                  <IconeFechar />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ChipStatus status={tarefa.status} />
              <Situacao t={tarefa} hoje={ctx.hoje} quando={quando} />
            </div>
            {ctx.podeEditar && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => acoes.editar(tarefa)} className={`${botao} border border-line hover:border-accent`}>Editar</button>
                {estaConcluida(tarefa) ? (
                  <button type="button" onClick={() => acoes.reabrir(tarefa)} className={`${botao} border border-line hover:border-accent`}>Reabrir</button>
                ) : (
                  <button type="button" onClick={() => acoes.concluir(tarefa)} className={`${botao} border border-ok text-ok hover:bg-ok-soft`}>
                    {tarefa.status === "agendado" ? "Marcar como publicado" : "Concluir"}
                  </button>
                )}
                {tarefa.arquivada_em ? (
                  <button type="button" onClick={() => acoes.restaurar(tarefa)} className={`${botao} border border-line hover:border-accent`}>Restaurar</button>
                ) : (
                  <button type="button" onClick={() => acoes.arquivar(tarefa)} className={`${botao} border border-line hover:border-accent`}>Arquivar</button>
                )}
              </div>
            )}
            {acoes.erro && <p role="alert" className="text-sm text-danger">{acoes.erro}</p>}
          </header>

          <div className="grid content-start gap-6 overflow-y-auto p-5">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
              {ctx.perfis.length > 0 && (
                <Campo icone={<IconeArroba />} rotulo="Perfil">
                  {perfilPorId(ctx.perfis, tarefa.perfil_id) ? `@${perfilPorId(ctx.perfis, tarefa.perfil_id)!.handle}` : <span className="text-muted">Sem perfil</span>}
                </Campo>
              )}
              <Campo icone={<IconePessoa />} rotulo="Responsável">
                {tarefa.responsavel ? (nomes.get(tarefa.responsavel) ?? "Pessoa removida") : <span className="text-muted">Sem responsável</span>}
              </Campo>
              <Campo icone={<IconeRelogio />} rotulo="Data da tarefa">
                {tarefa.vencimento ? dataCurta(tarefa.vencimento) : <span className="text-muted">Sem data</span>}
              </Campo>
              <Campo icone={<IconeCalendario />} rotulo="Publicação">
                {tarefa.data_publicacao ? dataCurta(tarefa.data_publicacao) : <span className="text-muted">Sem data</span>}
              </Campo>
              <Campo icone={<IconeLink />} rotulo="Roteiro">
                <LinkExterno url={tarefa.link_roteiro} />
              </Campo>
              <Campo icone={<IconeLink />} rotulo="Drive">
                <LinkExterno url={tarefa.link_drive} />
              </Campo>
            </dl>
            <p className="text-xs text-muted">
              Criada em {quando.format(new Date(tarefa.criado_em))}
              {tarefa.criado_por && nomes.get(tarefa.criado_por) ? ` por ${nomes.get(tarefa.criado_por)}` : ""}.
              {" "}Última alteração em {quando.format(new Date(tarefa.atualizado_em))}
              {tarefa.atualizado_por && nomes.get(tarefa.atualizado_por) ? ` por ${nomes.get(tarefa.atualizado_por)}` : ""}.
            </p>

            <Comentarios ctx={ctx} tarefaId={tarefa.id} quando={quando} />
            <Historico tarefaId={tarefa.id} versao={tarefa.atualizado_em} nomes={nomes} quando={quando} />
          </div>
        </div>
      )}
      {acoes.dialogos}
    </dialog>
  );
}

function Situacao({ t, hoje, quando }: { t: Tarefa; hoje: string; quando: Intl.DateTimeFormat }) {
  return (
    <>
      {t.concluida_em && (
        <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-ok">
          Concluída em {quando.format(new Date(t.concluida_em))}
        </span>
      )}
      {estaAtrasada(t, hoje) && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">Atrasada</span>}
      {t.arquivada_em && (
        <span className="rounded-full bg-lane px-2 py-0.5 text-[11px] font-semibold text-muted">
          {t.arquivada_auto ? "Arquivada automaticamente" : "Arquivada"} em {quando.format(new Date(t.arquivada_em))}
        </span>
      )}
    </>
  );
}

function Campo({ icone, rotulo, children }: { icone: React.ReactNode; rotulo: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 text-muted">
        <span aria-hidden className="[&>svg]:size-4">{icone}</span>
        {rotulo}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function LinkExterno({ url }: { url: string | null }) {
  if (!url) return <span className="text-muted">Sem link</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium text-accent-strong underline-offset-2 hover:underline">
      {url.replace(/^https?:\/\//, "")}
    </a>
  );
}

function Comentarios({ ctx, tarefaId, quando }: { ctx: Contexto; tarefaId: number; quando: Intl.DateTimeFormat }) {
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    lerComentarios(tarefaId).then((r) => vivo && (r.erro ? setErro(r.erro) : setLista(r.ok!)));
    // Comentários de outras pessoas chegam na hora.
    const limpar = aoVivo(`comentarios-${tarefaId}`, (c) => c
      .on("postgres_changes", { event: "INSERT", schema: "hub", table: "tarefa_comentarios", filter: `tarefa_id=eq.${tarefaId}` }, (p) => {
        const c = p.new as Comentario;
        setLista((l) => (l && !l.some((x) => x.id === c.id) ? [...l, c] : l));
      })
      .on("postgres_changes", { event: "DELETE", schema: "hub", table: "tarefa_comentarios" }, (p) => {
        const id = (p.old as { id?: number }).id;
        setLista((l) => l?.filter((x) => x.id !== id) ?? l);
      })
    );
    return () => {
      vivo = false;
      limpar();
    };
  }, [tarefaId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    if (t.length > 4000) return setErro("O comentário pode ter até 4.000 caracteres.");
    setEnviando(true);
    const r = await comentar(tarefaId, t);
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    setErro(null);
    setTexto("");
    setLista((l) => (l && !l.some((x) => x.id === r.ok!.id) ? [...l, r.ok!] : l));
  }

  async function apagar(id: number) {
    const r = await apagarComentario(id);
    if (r.erro) return setErro(r.erro);
    setLista((l) => l?.filter((x) => x.id !== id) ?? l);
  }

  return (
    <section aria-labelledby="comentarios-titulo" className="grid gap-3">
      <h3 id="comentarios-titulo" className="font-display text-base font-bold">
        Comentários {lista && lista.length > 0 && <span className="font-sans text-sm font-normal text-muted">({lista.length})</span>}
      </h3>
      {lista === null && !erro && <LinhasCarregando rotulo="Carregando comentários" />}
      {lista?.length === 0 && <p className="text-sm text-muted">Nenhum comentário ainda.</p>}
      <ul className="grid gap-3">
        {lista?.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Iniciais nome={c.autor_nome} className="size-7 text-[11px]" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold">{c.autor_nome}</span>
                <time dateTime={c.criado_em} className="text-xs text-muted">{quando.format(new Date(c.criado_em))}</time>
                {c.autor === ctx.eu && (
                  <button type="button" onClick={() => apagar(c.id)} aria-label="Excluir meu comentário" className="ml-auto grid size-6 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger">
                    <IconeLixeira className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm break-words whitespace-pre-wrap">{c.texto}</p>
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={enviar} className="grid gap-2">
        <label htmlFor={`novo-comentario-${tarefaId}`} className="sr-only">Escrever comentário</label>
        <textarea
          id={`novo-comentario-${tarefaId}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(e);
          }}
          rows={3}
          maxLength={4000}
          placeholder="Escreva um comentário…"
          className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm"
        />
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={enviando || !texto.trim()} className={`${botao} bg-accent font-semibold text-accent-ink disabled:opacity-50`}>
            {enviando ? "Enviando…" : "Comentar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Historico({ tarefaId, versao, nomes, quando }: { tarefaId: number; versao: string; nomes: Map<string, string>; quando: Intl.DateTimeFormat }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  useEffect(() => {
    let vivo = true;
    lerEventos(tarefaId).then((r) => vivo && setEventos(r.ok ?? []));
    return () => {
      vivo = false;
    };
  }, [tarefaId, versao]);

  return (
    <section aria-labelledby="historico-titulo" className="grid gap-2">
      <h3 id="historico-titulo" className="font-display text-base font-bold">Histórico</h3>
      {eventos === null ? (
        <LinhasCarregando rotulo="Carregando histórico" />
      ) : (
        <ol className="grid gap-1.5 text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="text-muted">
              <span className="font-medium text-ink">{e.autor_nome}</span> {descreverEvento(e, nomes)}
              <span className="text-xs"> · {quando.format(new Date(e.criado_em))}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
