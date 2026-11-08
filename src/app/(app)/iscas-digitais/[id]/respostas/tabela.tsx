"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IconeAnterior, IconeLixeira } from "@/components/icones";
import type { ContextoLeads } from "@/lib/dados-leads";
import { ehTela, metricas, respostasParaCsv, textoResposta, type Formulario, type Pergunta, type RespostaForm } from "@/lib/formularios";
import { excluirResposta } from "@/lib/formularios-api";
import { botao } from "../../../planejador/ui";

type Filtro = "concluidas" | "parciais" | "qualificadas" | "todas";
const STATUS_LEAD: Record<string, string> = { criado: "Lead criado", existente: "Lead já existia", sem_funil: "Não cria lead", erro: "Lead não criado" };

export function TabelaRespostas({ ctx, form, iniciais, leads }: { ctx: ContextoLeads; form: Formulario; iniciais: RespostaForm[]; leads: { id: number; handle: string }[] }) {
  const [lista, setLista] = useState(iniciais);
  const [filtro, setFiltro] = useState<Filtro>("concluidas");
  const [aberta, setAberta] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Colunas: as perguntas publicadas (o que as pessoas responderam); sem versão no ar, o rascunho.
  const perguntas: Pergunta[] = (form.publicado?.perguntas ?? form.perguntas).filter((p) => !ehTela(p));
  const m = metricas(form.visitas, lista);
  const handles = new Map(leads.map((l) => [l.id, l.handle]));
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: ctx.fuso });
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

  const visiveis = useMemo(
    () =>
      lista.filter((r) =>
        filtro === "todas" ? true : filtro === "concluidas" ? !!r.concluido_em : filtro === "parciais" ? !r.concluido_em && Object.keys(r.respostas ?? {}).length > 0 : !!r.concluido_em && r.qualificado === true,
      ),
    [lista, filtro],
  );

  function baixar() {
    const csv = respostasParaCsv(perguntas, visiveis, ctx.fuso);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `respostas-${form.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid max-w-6xl gap-5">
      <header className="grid gap-1">
        <Link href={`/iscas-digitais/${form.id}`} className="flex w-fit items-center gap-1 text-sm text-muted hover:text-ink"><IconeAnterior /> {form.titulo}</Link>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Respostas</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Visitas", String(m.visitas), "abriram o link"],
          ["Começaram", String(m.iniciadas), "responderam algo"],
          ["Enviaram", String(m.concluidas), "chegaram ao fim"],
          ["Conversão", pct(m.conversao), "das visitas"],
          ["Abandono", pct(m.abandono), "de quem começou"],
          ["Qualificados", String(m.qualificadas), "pela qualificação"],
        ].map(([r, v, s]) => (
          <div key={r} className="grid gap-1 rounded-balao border border-line bg-surface p-3 shadow-card">
            <span className="text-xs font-medium text-muted">{r}</span>
            <span className="font-display text-2xl font-bold tabular-nums">{v}</span>
            <span className="text-[11px] text-muted">{s}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Filtrar respostas" className="flex flex-wrap gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm shadow-card">
          {([["concluidas", "Enviadas"], ["parciais", "Sem terminar"], ["qualificadas", "Qualificadas"], ["todas", "Todas"]] as const).map(([v, r]) => (
            <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)} className={`rounded-md px-3 py-1.5 ${filtro === v ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}>
              {r}
            </button>
          ))}
        </nav>
        <button type="button" onClick={baixar} disabled={!visiveis.length} className={`${botao} border border-line hover:border-accent disabled:opacity-50`}>
          Baixar planilha (CSV)
        </button>
      </div>
      {visiveis.length > 0 && <p className="text-xs text-muted">A planilha tem nome, telefone e e-mail de quem respondeu. Guarde com cuidado.</p>}
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}

      {visiveis.length === 0 ? (
        <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-muted">Nenhuma resposta aqui ainda.</p>
      ) : (
        <ul className="grid gap-2">
          {visiveis.map((r) => {
            const handle = r.lead_id ? handles.get(r.lead_id) : null;
            const resumo = perguntas.slice(0, 3).map((p) => textoResposta(r.respostas?.[p.id], p)).filter(Boolean).join(" · ");
            return (
              <li key={r.id} className="rounded-balao border border-line bg-surface shadow-card">
                <button type="button" onClick={() => setAberta(aberta === r.id ? null : r.id)} aria-expanded={aberta === r.id} className="grid w-full gap-1 p-4 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0 truncate font-medium">{resumo || <i className="text-muted">Sem respostas ainda</i>}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {r.concluido_em ? quando.format(new Date(r.concluido_em)) : `Começou ${quando.format(new Date(r.iniciado_em))}`}
                    {!r.concluido_em && <span className="rounded-full bg-lane px-2 py-0.5 font-semibold">Sem terminar</span>}
                    {r.qualificado !== null && (
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${r.qualificado ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{r.qualificado ? "Qualificado" : "Não qualificado"}</span>
                    )}
                    {r.lead_status && <span className={`rounded-full px-2 py-0.5 font-semibold ${r.lead_status === "erro" ? "bg-danger-soft text-danger" : "bg-lane"}`}>{STATUS_LEAD[r.lead_status]}</span>}
                  </span>
                </button>
                {aberta === r.id && (
                  <div className="grid gap-3 border-t border-line p-4 text-sm">
                    <dl className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                      {perguntas.map((p) => (
                        <div key={p.id} className="contents">
                          <dt className="text-muted">{p.titulo}</dt>
                          <dd className="break-words">{textoResposta(r.respostas?.[p.id], p) || <span className="text-muted">—</span>}</dd>
                        </div>
                      ))}
                    </dl>
                    {Object.keys(r.origem ?? {}).length > 0 && (
                      <p className="text-xs text-muted">Origem: {Object.entries(r.origem).map(([k, v]) => `${k}=${v}`).join(" · ")}</p>
                    )}
                    {r.lead_erro && <p className="text-xs text-danger">Por que não virou lead: {r.lead_erro}</p>}
                    <div className="flex flex-wrap gap-2">
                      {r.lead_id && <Link href={`/leads?lead=${r.lead_id}`} className={`${botao} border border-line hover:border-accent`}>Abrir lead{handle ? ` @${handle}` : ""}</Link>}
                      {ctx.perm.gestor && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Excluir esta resposta? O lead, se houver, continua no funil.")) return;
                            const x = await excluirResposta(r.id);
                            if (x.erro) return setErro(x.erro);
                            setLista((l) => l.filter((y) => y.id !== r.id));
                          }}
                          className={`${botao} border border-line text-danger hover:border-danger`}
                        >
                          <IconeLixeira className="size-4" /> Excluir resposta
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
