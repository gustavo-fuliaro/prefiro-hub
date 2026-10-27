"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { IconeAnterior, IconeArquivar, IconeProximo } from "@/components/icones";
import { doPerfil, perfilPorId } from "@/lib/perfis-proprios";
import type { DiaCalendario } from "@/lib/calendario";
import { STATUS_LABEL, type Tarefa } from "@/lib/tarefas";
import { DetalhesTarefa } from "../planejador/detalhes";
import type { Contexto } from "../planejador/ui";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Estado = "producao" | "agendado" | "publicado" | "arquivado";
function estadoDe(t: Tarefa): Estado {
  if (t.arquivada_em) return "arquivado";
  if (t.status === "publicado") return "publicado";
  if (t.status === "agendado") return "agendado";
  return "producao";
}
// Cada estado tem cor e forma próprias; arquivado também leva ícone e texto riscado (não depende só da cor).
const ESTILO: Record<Estado, string> = {
  producao: "border-line bg-bg text-ink",
  agendado: "border-warn/50 bg-warn-soft text-ink",
  publicado: "border-ok/50 bg-ok-soft text-ink",
  arquivado: "border-dashed border-line-strong bg-surface text-muted",
};
const LEGENDA: { e: Estado; rotulo: string }[] = [
  { e: "producao", rotulo: "Em produção" },
  { e: "agendado", rotulo: "Agendado" },
  { e: "publicado", rotulo: "Publicado" },
  { e: "arquivado", rotulo: "Arquivado" },
];

function nomeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function CalendarioTarefas({
  ctx,
  mes,
  anterior,
  proximo,
  grade,
  visao,
  iniciais,
}: {
  ctx: Contexto;
  mes: string;
  anterior: string;
  proximo: string;
  grade: DiaCalendario[][];
  visao: "mes" | "lista";
  iniciais: Tarefa[];
}) {
  const [tarefas, setTarefas] = useState(iniciais);
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const nomes = new Map(ctx.membros.map((m) => [m.user_id, m.nome]));
  const porDia = new Map<string, Tarefa[]>();
  const grupo = ctx.perfilAtual === null && ctx.perfis.length > 0;
  for (const t of doPerfil(tarefas, ctx.perfilAtual)) if (t.data_publicacao) porDia.set(t.data_publicacao, [...(porDia.get(t.data_publicacao) ?? []), t]);
  const link = (extra: Record<string, string>) => `/calendario?${new URLSearchParams({ mes, visao, ...extra })}`;
  const doMes = [...porDia.entries()].filter(([d]) => d.startsWith(mes)).sort(([a], [b]) => a.localeCompare(b));

  function Item({ t, compacto }: { t: Tarefa; compacto?: boolean }) {
    const e = estadoDe(t);
    const resp = t.responsavel ? (nomes.get(t.responsavel) ?? "Pessoa removida") : "Sem responsável";
    const situacao = e === "arquivado" ? `Arquivado · ${STATUS_LABEL[t.status]}` : STATUS_LABEL[t.status];
    const perfil = perfilPorId(ctx.perfis, t.perfil_id);
    const arroba = perfil ? `@${perfil.handle}` : "Sem perfil";
    return (
      <button
        type="button"
        onClick={() => setDetalhe(t.id)}
        title={`${grupo ? arroba + " · " : ""}${t.titulo} · ${resp} · ${situacao}`}
        className={`flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs transition-colors hover:border-accent ${ESTILO[e]}`}
      >
        {grupo && (perfil ? <Avatar caminho={perfil.foto_path} handle={perfil.handle} tamanho={16} /> : <span aria-hidden className="size-4 shrink-0 rounded-full border border-dashed border-line-strong" />)}
        {e === "arquivado" && <IconeArquivar className="size-3 shrink-0" />}
        <span className={`truncate ${e === "arquivado" ? "line-through decoration-1" : "font-medium"}`}>{t.titulo}</span>
        {!compacto && (
          <span className="ml-auto shrink-0 text-muted">
            {grupo ? `${arroba} · ` : ""}{resp} · {situacao}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={link({ mes: anterior })} className="grid size-9 place-items-center rounded-md border border-line bg-surface hover:border-accent" aria-label="Mês anterior">
            <IconeAnterior />
          </Link>
          <h2 className="min-w-44 text-center font-display text-xl font-bold">{nomeMes(mes)}</h2>
          <Link href={link({ mes: proximo })} className="grid size-9 place-items-center rounded-md border border-line bg-surface hover:border-accent" aria-label="Próximo mês">
            <IconeProximo />
          </Link>
          {mes !== ctx.hoje.slice(0, 7) && (
            <Link href={link({ mes: ctx.hoje.slice(0, 7) })} className="text-sm text-accent-strong hover:underline">Hoje</Link>
          )}
        </div>
        <nav aria-label="Visão" className="flex gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm shadow-card">
          {[["mes", "Mês"], ["lista", "Lista"]].map(([v, r]) => (
            <Link
              key={v}
              href={link({ visao: v })}
              aria-current={visao === v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${visao === v ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {r}
            </Link>
          ))}
        </nav>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Legenda">
        {LEGENDA.map(({ e, rotulo }) => (
          <li key={e} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block h-3 w-5 rounded border ${ESTILO[e]}`} />
            {rotulo}
          </li>
        ))}
      </ul>

      {visao === "mes" ? (
        <div className="overflow-x-auto rounded-balao border border-line bg-surface shadow-card">
          <div className="grid min-w-[760px] grid-cols-7">
            {SEMANA.map((d) => (
              <div key={d} className="border-b border-line px-2 py-2 text-center text-xs font-semibold text-muted">{d}</div>
            ))}
            {grade.flat().map((dia) => {
              const itens = porDia.get(dia.data) ?? [];
              return (
                <div key={dia.data} className={`min-h-28 border-r border-b border-line p-1.5 ${dia.doMes ? "" : "bg-bg opacity-60"}`}>
                  <div className={`mb-1 text-right text-xs tabular-nums ${dia.hoje ? "font-bold text-accent-strong" : "text-muted"}`}>
                    {Number(dia.data.slice(8))}
                  </div>
                  <div className="grid gap-1">
                    {itens.slice(0, 4).map((t) => (
                      <Item key={t.id} t={t} compacto />
                    ))}
                    {itens.length > 4 && (
                      <Link href={link({ visao: "lista" })} className="px-1 text-xs text-muted hover:text-ink">
                        +{itens.length - 4} mais
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : doMes.length === 0 ? (
        <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-muted">Nenhuma publicação em {nomeMes(mes).toLowerCase()}.</p>
      ) : (
        <ol className="grid gap-4">
          {doMes.map(([dia, itens]) => (
            <li key={dia} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
              <div className="font-semibold tabular-nums">{dia.split("-").reverse().join("/")}</div>
              <ul className="grid gap-1.5">
                {itens.map((t) => (
                  <li key={t.id}>
                    <Item t={t} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {detalhe !== null && (
        <DetalhesTarefa
          key={detalhe}
          ctx={ctx}
          tarefaId={detalhe}
          tarefa={tarefas.find((t) => t.id === detalhe)}
          aoMudar={(t) => setTarefas((l) => l.map((x) => (x.id === t.id ? t : x)))}
          aoRemover={(id) => setTarefas((l) => l.filter((x) => x.id !== id))}
          aoFechar={() => setDetalhe(null)}
        />
      )}
    </div>
  );
}
