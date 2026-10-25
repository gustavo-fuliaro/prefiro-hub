"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ETAPAS_BRIEFING, chaveItem, progressoChecklist, type Checklist, type Ideia } from "@/lib/planejador";
import { salvarBriefing } from "../planejador/actions";

export function BriefingCard({
  ideia,
  coluna,
  quando,
  checklist,
  observacoes,
  linkPlanejador,
  podeEditar,
}: {
  ideia: Ideia;
  coluna: string;
  quando: string | null;
  checklist: Checklist;
  observacoes: string;
  linkPlanejador: string;
  podeEditar: boolean;
}) {
  const [marcados, setMarcados] = useState<Checklist>(checklist);
  const [obs, setObs] = useState(observacoes);
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const prog = progressoChecklist(marcados);

  // Vindo do planejador ("Abrir briefing"), já abre o checklist desta ideia.
  useEffect(() => {
    if (window.location.hash === `#ideia-${ideia.id}`) setAberto(true);
  }, [ideia.id]);

  function gravar(proximo: Checklist, texto: string) {
    setStatus(null);
    iniciar(async () => {
      const r = await salvarBriefing(ideia.id, proximo, texto);
      setStatus(r.erro ? { tipo: "erro", msg: r.erro } : { tipo: "ok", msg: "Salvo" });
    });
  }

  function alternar(chave: string) {
    const proximo = { ...marcados, [chave]: !marcados[chave] };
    if (!proximo[chave]) delete proximo[chave];
    setMarcados(proximo);
    gravar(proximo, obs);
  }

  return (
    <article id={`ideia-${ideia.id}`} className="scroll-mt-6 rounded-balao border border-line bg-surface p-4 target:border-accent shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{ideia.titulo}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {coluna}
            {ideia.formato ? ` · ${ideia.formato}` : ""}
            {quando ? ` · postar em ${quando}` : ""}
          </p>
        </div>
        <Link href={linkPlanejador} className="shrink-0 text-xs text-accent-strong hover:underline">Editar ideia</Link>
      </header>

      {ideia.gancho && <p className="mt-2 text-sm"><span className="font-semibold">Gancho:</span> {ideia.gancho}</p>}

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do checklist">
          <div className={`h-full ${prog.pct === 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${prog.pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted">{prog.feitos}/{prog.total}</span>
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="text-xs font-semibold text-accent-strong hover:underline">
          {aberto ? "Fechar checklist" : "Abrir checklist"}
        </button>
      </div>

      {aberto && (
        <div className="mt-4 grid gap-4">
          {ideia.tese && (
            <div className="rounded-balao-sm bg-bg p-3 text-sm">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Roteiro</div>
              <p className="whitespace-pre-line">{ideia.tese}</p>
              {ideia.cta && <p className="mt-2"><span className="font-semibold">CTA:</span> {ideia.cta}</p>}
            </div>
          )}

          {ETAPAS_BRIEFING.map((etapa) => (
            <fieldset key={etapa.id} disabled={!podeEditar} className="grid gap-1.5">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{etapa.rotulo}</legend>
              {etapa.itens.map((item, i) => {
                const chave = chaveItem(etapa.id, i);
                return (
                  <label key={chave} className="flex items-start gap-2 text-sm">
                    <input
                      id={`${ideia.id}-${chave}`}
                      type="checkbox"
                      checked={!!marcados[chave]}
                      onChange={() => alternar(chave)}
                      className="mt-0.5 size-4 accent-[var(--accent)]"
                    />
                    <span className={marcados[chave] ? "text-muted line-through" : ""}>{item}</span>
                  </label>
                );
              })}
            </fieldset>
          ))}

          <label className="grid gap-1 text-sm font-medium">
            Observações da gravação
            <textarea
              id={`obs-${ideia.id}`}
              rows={3}
              maxLength={2000}
              value={obs}
              disabled={!podeEditar}
              onChange={(e) => setObs(e.target.value)}
              onBlur={() => obs !== observacoes && gravar(marcados, obs)}
              className="rounded-md border border-line bg-bg px-3 py-2 font-normal"
              placeholder="Ex.: regravar o gancho com mais energia"
            />
          </label>
        </div>
      )}

      <p aria-live="polite" className="mt-2 h-4 text-xs">
        {pendente ? <span className="text-muted">Salvando…</span> : status && <span className={status.tipo === "ok" ? "text-ok" : "text-danger"}>{status.msg}</span>}
      </p>
    </article>
  );
}
