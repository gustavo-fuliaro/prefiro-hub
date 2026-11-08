"use client";

import { useEffect, useRef, useState } from "react";
import { IconeFechar, IconeLixeira } from "@/components/icones";
import { LinhasCarregando } from "@/components/marca";
import {
  colunasDoQuadro, descreverEventoLead, etapaDoPapel, linkInstagram, linkWhatsApp, podeAssumir, podeMexer, PRIORIDADE_LABEL,
  validarEmailLead, type EventoLead, type Lead, type Prioridade,
} from "@/lib/leads";
import { anotar, apagarNota, assumirLead, atualizarLead, excluirLead, lerEventosLead, lerLead, lerNotas, type NotaLead } from "@/lib/leads-api";
import { botao, botaoPrimario, campo, Iniciais } from "../planejador/ui";
import { ChipEtapa, ChipPrazo, ChipPrioridade, type Ctx, useAgora, useMoverLead, useNomes } from "./comum";

export function DetalhesLead({
  ctx, leadId, lead: doQuadro, aoMudar, aoRemover, aoFechar,
}: {
  ctx: Ctx;
  leadId: number;
  lead: Lead | undefined;
  aoMudar: (l: Lead) => void;
  aoRemover: (id: number) => void;
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [carregado, setCarregado] = useState<Lead | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [versao, setVersao] = useState(0); // recarrega o histórico após cada mudança
  const nomes = useNomes(ctx);
  const agora = useAgora();
  const lead = doQuadro ?? carregado;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    if (doQuadro) return;
    lerLead(leadId).then((r) => (r.erro ? setErroCarga(r.erro) : setCarregado(r.ok!)));
  }, [leadId, doQuadro]);

  const mudou = (l: Lead) => {
    setCarregado(l);
    aoMudar(l);
    setVersao((v) => v + 1);
  };
  const { mover, dialogo } = useMoverLead(mudou);
  const fechar = () => ref.current?.close();

  if (!lead) {
    return (
      <dialog ref={ref} onClose={aoFechar} aria-label="Lead" className="gaveta w-[min(520px,100vw)] border-l border-line bg-surface p-0 text-ink">
        <div className="grid h-full place-items-center p-6 text-muted">
          {erroCarga ? (
            <div className="grid gap-3 text-center">
              <p role="alert">{erroCarga}</p>
              <button type="button" onClick={fechar} className={`${botao} justify-center border border-line`}>Fechar</button>
            </div>
          ) : (
            <LinhasCarregando rotulo="Carregando lead" />
          )}
        </div>
      </dialog>
    );
  }

  const etapa = ctx.etapas.find((e) => e.id === lead.etapa_id) ?? null;
  const mexe = podeMexer(lead, ctx.perm);
  const assume = podeAssumir(lead, etapa, ctx.perm);
  const wa = linkWhatsApp(lead.telefone);
  const destinos = [...colunasDoQuadro(ctx.etapas), etapaDoPapel(ctx.etapas, "reservatorio"), etapaDoPapel(ctx.etapas, "terminal")].filter((e) => e !== null);
  const resultado = (r: { erro?: string }, ok: string) => setAviso(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: ok });

  return (
    <dialog ref={ref} onClose={aoFechar} aria-labelledby="lead-titulo" className="gaveta w-[min(520px,100vw)] border-l border-line bg-surface p-0 text-ink">
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
        <header className="grid gap-3 border-b border-line p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="lead-titulo" className="font-display text-xl leading-snug font-bold break-words">@{lead.handle}</h2>
              {lead.nome && <p className="text-sm text-muted">{lead.nome}</p>}
            </div>
            <button type="button" onClick={fechar} aria-label="Fechar" className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink">
              <IconeFechar />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ChipEtapa etapa={etapa} />
            <ChipPrioridade p={lead.prioridade} />
            <ChipPrazo expiraEm={lead.expira_em} agora={agora} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {assume && (
              <button
                type="button"
                className={botaoPrimario}
                onClick={async () => {
                  const r = await assumirLead(lead.id);
                  resultado(r, "Você assumiu este lead.");
                  const novo = await lerLead(lead.id);
                  if (novo.ok) mudou(novo.ok);
                }}
              >
                Assumir lead
              </button>
            )}
            <a href={linkInstagram(lead.handle)} target="_blank" rel="noopener noreferrer" className={`${botao} border border-line hover:border-accent`}>Abrir Instagram</a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${botao} border border-line hover:border-accent`}>WhatsApp</a>}
          </div>
          {aviso && <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`text-sm ${aviso.tipo === "erro" ? "text-danger" : "text-ok"}`}>{aviso.texto}</p>}
        </header>

        <div className="grid content-start gap-6 overflow-y-auto p-5">
          <section className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">Responsável</span>
              {ctx.perm.gestor ? (
                <select
                  aria-label="Responsável"
                  value={lead.responsavel ?? ""}
                  onChange={async (e) => {
                    const r = await atualizarLead(lead.id, { responsavel: e.target.value || null });
                    if (r.ok) mudou(r.ok);
                    resultado(r, "Responsável atualizado.");
                  }}
                  className="h-9 rounded-md border border-line bg-surface px-2.5"
                >
                  <option value="">Sem responsável</option>
                  {ctx.membros.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.nome}</option>
                  ))}
                </select>
              ) : (
                <span className="font-medium">{lead.responsavel ? (nomes.get(lead.responsavel) ?? "Pessoa removida") : "Sem responsável"}</span>
              )}
            </div>
            {mexe && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">Etapa</span>
                <select
                  aria-label="Mover para a etapa"
                  value={lead.etapa_id}
                  onChange={async (e) => {
                    const destino = ctx.etapas.find((x) => x.id === Number(e.target.value));
                    if (!destino) return;
                    const erro = await mover(lead, destino);
                    if (erro) setAviso({ tipo: "erro", texto: erro });
                  }}
                  className="h-9 rounded-md border border-line bg-surface px-2.5"
                >
                  {destinos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
            )}
            {lead.justificativa && <p><span className="text-muted">Motivo: </span>{lead.justificativa}</p>}
            {lead.data_retorno && <p><span className="text-muted">Retomar em: </span>{lead.data_retorno.split("-").reverse().join("/")}</p>}
          </section>

          <FormDados key={lead.atualizado_em} ctx={ctx} lead={lead} editavel={mexe} aoSalvar={(l) => { mudou(l); setAviso({ tipo: "ok", texto: "Dados salvos." }); }} aoErro={(t) => setAviso({ tipo: "erro", texto: t })} />

          <Notas ctx={ctx} leadId={lead.id} />
          <Historico leadId={lead.id} versao={versao} nomes={nomes} fuso={ctx.fuso} />

          {ctx.perm.gestor && (
            <button
              type="button"
              className={`${botao} w-fit border border-line text-danger hover:border-danger`}
              onClick={async () => {
                if (!confirm(`Excluir @${lead.handle} de vez? Notas e histórico também saem. Para descartar sem apagar, mova para Desqualificado.`)) return;
                const r = await excluirLead(lead.id);
                if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
                aoRemover(lead.id);
                fechar();
              }}
            >
              <IconeLixeira className="size-4" /> Excluir lead
            </button>
          )}
        </div>
      </div>
      {dialogo}
    </dialog>
  );
}

function FormDados({ ctx, lead, editavel, aoSalvar, aoErro }: { ctx: Ctx; lead: Lead; editavel: boolean; aoSalvar: (l: Lead) => void; aoErro: (t: string) => void }) {
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "").trim();
        if (email && !validarEmailLead(email)) return aoErro("Confira o e-mail.");
        setSalvando(true);
        const r = await atualizarLead(lead.id, {
          nome: String(fd.get("nome") ?? "").trim() || null,
          telefone: String(fd.get("telefone") ?? "").trim() || null,
          email: email || null,
          prioridade: fd.get("prioridade") as Prioridade,
          perfil_id: Number(fd.get("perfil_id")) || null,
          observacao: String(fd.get("observacao") ?? "").trim() || null,
          tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
        });
        setSalvando(false);
        if (r.erro) aoErro(r.erro);
        else aoSalvar(r.ok!);
      }}
    >
      <h3 className="font-display text-base font-bold">Dados</h3>
      <fieldset disabled={!editavel} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Nome
          <input name="nome" maxLength={120} defaultValue={lead.nome ?? ""} className={campo} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Telefone
          <input name="telefone" type="tel" maxLength={30} defaultValue={lead.telefone ?? ""} className={campo} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          E-mail
          <input name="email" type="email" defaultValue={lead.email ?? ""} className={campo} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Prioridade
          <select name="prioridade" defaultValue={lead.prioridade} className={campo}>
            {(["alta", "normal", "baixa"] as Prioridade[]).map((p) => (
              <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
            ))}
          </select>
        </label>
        {ctx.perfis.length > 0 && (
          <label className="grid gap-1 text-sm font-medium">
            Veio pelo perfil
            <select name="perfil_id" defaultValue={String(lead.perfil_id ?? "")} className={campo}>
              <option value="">Nenhum</option>
              {ctx.perfis.map((p) => (
                <option key={p.id} value={p.id}>@{p.handle}</option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Etiquetas <span className="font-normal text-muted">(separe por vírgula)</span>
          <input name="tags" defaultValue={lead.tags.join(", ")} className={campo} placeholder="Ex.: imóvel, indicação" />
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Observação
          <textarea name="observacao" maxLength={2000} rows={3} defaultValue={lead.observacao ?? ""} className="rounded-md border border-line bg-bg px-3 py-2 font-normal" />
        </label>
      </fieldset>
      {editavel ? (
        <button type="submit" disabled={salvando} className={`${botaoPrimario} w-fit`}>{salvando ? "Salvando…" : "Salvar dados"}</button>
      ) : (
        <p className="text-xs text-muted">Só o responsável pelo lead ou a gestão podem editar.</p>
      )}
    </form>
  );
}

function Notas({ ctx, leadId }: { ctx: Ctx; leadId: number }) {
  const [lista, setLista] = useState<NotaLead[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: ctx.fuso });
  useEffect(() => {
    lerNotas(leadId).then((r) => (r.erro ? setErro(r.erro) : setLista(r.ok!)));
  }, [leadId]);
  return (
    <section aria-labelledby="notas-titulo" className="grid gap-3">
      <h3 id="notas-titulo" className="font-display text-base font-bold">Notas</h3>
      {lista?.length === 0 && <p className="text-sm text-muted">Nenhuma nota ainda.</p>}
      <ul className="grid gap-3">
        {lista?.map((n) => (
          <li key={n.id} className="flex gap-3">
            <Iniciais nome={n.autor_nome} className="size-7 text-[11px]" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold">{n.autor_nome}</span>
                <time dateTime={n.criado_em} className="text-xs text-muted">{quando.format(new Date(n.criado_em))}</time>
                {n.autor === ctx.eu && (
                  <button
                    type="button"
                    aria-label="Excluir minha nota"
                    onClick={async () => {
                      const r = await apagarNota(n.id);
                      if (r.erro) setErro(r.erro);
                      else setLista((l) => (l ?? []).filter((x) => x.id !== n.id));
                    }}
                    className="ml-auto grid size-6 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <IconeLixeira className="size-3.5" />
                  </button>
                )}
              </div>
              <p className="text-sm break-words whitespace-pre-wrap">{n.texto}</p>
            </div>
          </li>
        ))}
      </ul>
      {ctx.perm.trabalha && (
        <form
          className="grid gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!texto.trim()) return;
            const r = await anotar(leadId, texto.trim());
            if (r.erro) return setErro(r.erro);
            setLista((l) => [...(l ?? []), r.ok!]);
            setTexto("");
            setErro(null);
          }}
        >
          <label htmlFor={`nota-${leadId}`} className="sr-only">Escrever nota</label>
          <textarea id={`nota-${leadId}`} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={2} placeholder="Ex.: respondeu o direct, pediu simulação" className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm" />
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
          <button type="submit" disabled={!texto.trim()} className={`${botao} w-fit bg-accent font-semibold text-accent-ink disabled:opacity-50`}>Anotar</button>
        </form>
      )}
    </section>
  );
}

function Historico({ leadId, versao, nomes, fuso }: { leadId: number; versao: number; nomes: Map<string, string>; fuso: string }) {
  const [eventos, setEventos] = useState<EventoLead[] | null>(null);
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso });
  useEffect(() => {
    lerEventosLead(leadId).then((r) => setEventos(r.ok ?? []));
  }, [leadId, versao]);
  return (
    <section aria-labelledby="historico-lead" className="grid gap-2">
      <h3 id="historico-lead" className="font-display text-base font-bold">Histórico</h3>
      {!eventos ? (
        <LinhasCarregando rotulo="Carregando histórico" />
      ) : (
        <ol className="grid gap-2 text-sm">
          {eventos.map((e) => (
            <li key={e.id} className="grid gap-0.5 border-l-2 border-line pl-3">
              <span><span className="font-semibold">{e.autor_nome}</span> {descreverEventoLead(e, nomes)}</span>
              <time dateTime={e.criado_em} className="text-xs text-muted">{quando.format(new Date(e.criado_em))}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
