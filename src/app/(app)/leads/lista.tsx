"use client";

import { useMemo, useState } from "react";
import { IconeBusca } from "@/components/icones";
import { etapaDoPapel, etapaFollowUp, filtrarLeads, FILTROS_LEAD_PADRAO, ordenarLeads, podeAssumir, type Lead } from "@/lib/leads";
import { assumirLead, lerLead } from "@/lib/leads-api";
import { doPerfil } from "@/lib/perfis-proprios";
import { ChipEtapa, ChipPrazo, ChipPrioridade, type Ctx, EtiquetaPerfilLead, inicioDoDia, useAgora, useLeadsAoVivo, useNomes } from "./comum";
import { DetalhesLead } from "./detalhes";

// Follow-up: quem está na primeira etapa de trabalho, o que vence primeiro em cima.
// Base Geral: leads sem responsável esperando alguém assumir; ao lado, os desqualificados.
export function ListaLeads({ ctx, iniciais, modo, abrir }: { ctx: Ctx; iniciais: Lead[]; modo: "followup" | "base"; abrir: number | null }) {
  const { leads, aplicar, remover, conectado } = useLeadsAoVivo(ctx, iniciais);
  const [busca, setBusca] = useState("");
  const [meus, setMeus] = useState(modo === "followup" && !ctx.perm.gestor);
  const [aba, setAba] = useState<"base" | "desqualificados">("base");
  const [soExpirados, setSoExpirados] = useState(false);
  const [detalhe, setDetalhe] = useState<number | null>(abrir);
  const [erro, setErro] = useState<string | null>(null);
  const agora = useAgora();
  const nomes = useNomes(ctx);

  const etapa = modo === "followup" ? etapaFollowUp(ctx.etapas) : etapaDoPapel(ctx.etapas, aba === "base" ? "reservatorio" : "terminal");
  const visiveis = useMemo(() => {
    if (!etapa) return [];
    const daEtapa = doPerfil([...leads.values()].filter((l) => l.etapa_id === etapa.id), ctx.perfilAtual);
    const filtrados = filtrarLeads(daEtapa, { ...FILTROS_LEAD_PADRAO, busca, responsavel: meus ? "meus" : "todos" }, { eu: ctx.eu, hojeInicio: inicioDoDia(ctx.hoje, ctx.fuso) })
      .filter((l) => !soExpirados || l.expirado_em !== null);
    return modo === "followup" ? ordenarLeads(filtrados) : [...filtrados].sort((a, b) => b.etapa_desde.localeCompare(a.etapa_desde));
  }, [leads, etapa, ctx.perfilAtual, busca, meus, soExpirados, modo, ctx.eu, ctx.hoje, ctx.fuso]);
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: ctx.fuso });

  function abrirDetalhe(id: number | null) {
    setDetalhe(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("lead", String(id));
    else url.searchParams.delete("lead");
    window.history.replaceState(null, "", url);
  }

  if (!etapa) return <p className="text-muted">Este funil não tem uma etapa de follow-up. Um admin pode criar em Configurações.</p>;

  return (
    <div className="grid gap-4">
      {modo === "base" && (
        <nav aria-label="Lista" className="flex w-fit gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm shadow-card">
          {(["base", "desqualificados"] as const).map((a) => (
            <button key={a} type="button" aria-pressed={aba === a} onClick={() => setAba(a)}
              className={`rounded-md px-3 py-1.5 ${aba === a ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}>
              {a === "base" ? "Para reaproveitar" : "Desqualificados"}
            </button>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar lead</span>
          <IconeBusca className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar @ ou nome" className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9" />
        </label>
        {modo === "followup" && (
          <button type="button" aria-pressed={meus} onClick={() => setMeus(!meus)} className={`h-10 rounded-md border px-3 text-sm font-medium ${meus ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface"}`}>
            Só os meus
          </button>
        )}
        {modo === "base" && aba === "base" && (
          <button type="button" aria-pressed={soExpirados} onClick={() => setSoExpirados(!soExpirados)} className={`h-10 rounded-md border px-3 text-sm font-medium ${soExpirados ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface"}`}>
            Só os que expiraram
          </button>
        )}
      </div>

      <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite" className="text-muted">
          {visiveis.length} {visiveis.length === 1 ? "lead" : "leads"}{" "}
          {modo === "followup" ? `em ${etapa.nome}` : aba === "base" ? "esperando alguém assumir" : "desqualificados"}
        </p>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className={`size-2 rounded-full ${conectado ? "bg-ok" : "bg-line-strong"}`} />
          {conectado ? "Ao vivo" : "Conectando"}
        </span>
      </div>
      {erro && <p role="alert" className="rounded-md bg-danger-soft px-4 py-2 text-sm text-danger">{erro}</p>}

      {visiveis.length === 0 ? (
        <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-muted">
          {modo === "followup" ? "Ninguém esperando retorno agora." : aba === "base" ? "A Base Geral está vazia." : "Nenhum lead desqualificado."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {visiveis.map((l) => (
            <li key={l.id} className="grid gap-3 rounded-balao border border-line bg-surface p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="grid min-w-0 gap-1">
                <button type="button" onClick={() => abrirDetalhe(l.id)} className="truncate text-left font-semibold hover:text-accent-strong">
                  @{l.handle}{l.nome ? <span className="font-normal text-muted"> · {l.nome}</span> : null}
                </button>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {ctx.perfilAtual === null && ctx.perfis.length > 0 && <EtiquetaPerfilLead ctx={ctx} perfilId={l.perfil_id} />}
                  <ChipPrioridade p={l.prioridade} />
                  {modo === "followup" ? (
                    <>
                      <ChipPrazo expiraEm={l.expira_em} agora={agora} />
                      <span>{l.responsavel ? (nomes.get(l.responsavel) ?? "Pessoa removida") : "Sem responsável"}</span>
                    </>
                  ) : (
                    <>
                      <ChipEtapa etapa={etapa} />
                      <span>
                        {aba === "base" ? (l.expirado_em ? `Expirou em ${quando.format(new Date(l.expirado_em))}` : `Na base desde ${quando.format(new Date(l.etapa_desde))}`) : `Desde ${quando.format(new Date(l.etapa_desde))}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => abrirDetalhe(l.id)} className="h-9 rounded-md border border-line px-3 text-sm hover:border-accent">Detalhes</button>
                {podeAssumir(l, etapa, ctx.perm) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await assumirLead(l.id);
                      setErro(r.erro ?? null);
                      const novo = await lerLead(l.id);
                      if (novo.ok) aplicar(novo.ok);
                    }}
                    className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink"
                    title={etapa.papel === "reservatorio" ? "Volta para a primeira coluna, com você como responsável" : undefined}
                  >
                    Assumir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {detalhe !== null && (
        <DetalhesLead key={detalhe} ctx={ctx} leadId={detalhe} lead={leads.get(detalhe)} aoMudar={aplicar} aoRemover={remover} aoFechar={() => abrirDetalhe(null)} />
      )}
    </div>
  );
}
