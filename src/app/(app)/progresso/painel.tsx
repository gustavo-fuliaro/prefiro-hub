"use client";

import { useEffect, useMemo, useState } from "react";
import { resumoProducao } from "@/lib/producao";
import { aoVivo as aoVivoCanal } from "@/lib/tarefas-api";
import { STATUS_LABEL, STATUS_ORDEM, type Tarefa } from "@/lib/tarefas";
import { Kpi } from "./kpi";

// Produção agora: contagens do quadro que se atualizam sozinhas quando a equipe mexe nas tarefas.
export function PainelAoVivo({
  contaId,
  hoje,
  membros,
  iniciais,
}: {
  contaId: number;
  hoje: string;
  membros: { user_id: string; nome: string }[];
  iniciais: Tarefa[];
}) {
  const [tarefas, setTarefas] = useState(() => new Map(iniciais.map((t) => [t.id, t])));
  const [aoVivo, setAoVivo] = useState(false);

  useEffect(() => {
    return aoVivoCanal(`progresso-${contaId}`, (c) => c
      .on("postgres_changes", { event: "*", schema: "hub", table: "tarefas", filter: `conta_id=eq.${contaId}` }, (p) =>
        setTarefas((m) => {
          const novo = new Map(m);
          if (p.eventType === "DELETE") novo.delete((p.old as { id: number }).id);
          else {
            const t = p.new as Tarefa;
            if (t.arquivada_em) novo.delete(t.id);
            else novo.set(t.id, t);
          }
          return novo;
        }),
      )
    , setAoVivo);
  }, [contaId]);

  const r = useMemo(() => resumoProducao([...tarefas.values()], hoje, membros), [tarefas, hoje, membros]);
  const maior = Math.max(1, ...STATUS_ORDEM.map((s) => r.porEtapa[s]));

  return (
    <section aria-labelledby="producao-agora" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="producao-agora" className="font-display text-xl font-bold">Produção agora</h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span aria-hidden className={`size-2 rounded-full ${aoVivo ? "bg-ok" : "bg-line-strong"}`} />
          {aoVivo ? "Atualiza sozinho" : "Conectando"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Tarefas ativas" valor={String(r.ativas)} />
        <Kpi rotulo="Em andamento" valor={String(r.emAndamento)} />
        <Kpi rotulo="Atrasadas" valor={String(r.atrasadas)} tom={r.atrasadas > 0 ? "perigo" : undefined} />
        <Kpi rotulo="Concluídas" valor={String(r.concluidas)} tom={r.concluidas > 0 ? "ok" : undefined} />
        <Kpi rotulo="Agendadas" valor={String(r.agendadas)} />
        <Kpi rotulo="Publicadas" valor={String(r.publicadas)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3 rounded-balao border border-line bg-surface p-4 shadow-card">
          <h3 className="font-display text-base font-bold">Tarefas por etapa</h3>
          <ul className="grid gap-2.5">
            {STATUS_ORDEM.map((s) => (
              <li key={s} className="grid grid-cols-[9.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
                <span className="truncate">{STATUS_LABEL[s]}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-lane" aria-hidden>
                  <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(r.porEtapa[s] / maior) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{r.porEtapa[s]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid content-start gap-3 rounded-balao border border-line bg-surface p-4 shadow-card">
          <h3 className="font-display text-base font-bold">Por responsável</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1.5 font-semibold">Pessoa</th>
                  <th className="py-1.5 text-right font-semibold">Ativas</th>
                  <th className="py-1.5 text-right font-semibold">Atrasadas</th>
                  <th className="py-1.5 text-right font-semibold">Concluídas</th>
                </tr>
              </thead>
              <tbody>
                {r.porResponsavel.map((l) => (
                  <tr key={l.id ?? "sem"} className="border-t border-line">
                    <td className={`py-2 ${l.id ? "font-medium" : "text-muted"}`}>{l.nome}</td>
                    <td className="py-2 text-right tabular-nums">{l.ativas}</td>
                    <td className={`py-2 text-right tabular-nums ${l.atrasadas > 0 ? "font-semibold text-danger" : ""}`}>{l.atrasadas}</td>
                    <td className="py-2 text-right tabular-nums">{l.concluidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
