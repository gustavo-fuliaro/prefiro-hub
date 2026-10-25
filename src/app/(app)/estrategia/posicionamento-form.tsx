"use client";

import { useState, useTransition } from "react";
import { MIN_RESPOSTA, PERGUNTAS_POSICIONAMENTO, completudePosicionamento, type Pilar, type Posicionamento } from "@/lib/estudio";
import { salvarPosicionamento } from "./actions";

const campo = "rounded-md border border-line bg-bg px-3 py-2 font-normal disabled:opacity-70";

export function PosicionamentoForm({ perfilId, inicial, podeEditar }: { perfilId: number; inicial: Posicionamento; podeEditar: boolean }) {
  const [respostas, setRespostas] = useState<Record<string, string>>(inicial.respostas ?? {});
  const [pilares, setPilares] = useState<Pilar[]>(inicial.pilares?.length ? inicial.pilares : [{ nome: "", descricao: "" }]);
  const [status, setStatus] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const comp = completudePosicionamento({ respostas, pilares });

  function salvar() {
    setStatus(null);
    iniciar(async () => {
      const r = await salvarPosicionamento(perfilId, { respostas, pilares });
      setStatus(r.erro ? { tipo: "erro", msg: r.erro } : { tipo: "ok", msg: r.ok! });
    });
  }

  const alterarPilar = (i: number, chave: keyof Pilar, valor: string) =>
    setPilares((ps) => ps.map((p, j) => (j === i ? { ...p, [chave]: valor } : p)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
      className="grid gap-8"
    >
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${comp.pronto ? "border-ok bg-ok-soft text-ok" : "border-warn bg-warn-soft text-warn"}`}
      >
        {comp.pronto
          ? `Posicionamento pronto para a IA: ${comp.respondidas} de ${comp.total} respostas e ${comp.pilares} pilares.`
          : `Para a IA escrever no tom do perfil, responda pelo menos 5 perguntas (${comp.respondidas}/${comp.total}) e defina 2 pilares (${comp.pilares}).`}
      </div>

      <fieldset disabled={!podeEditar || pendente} className="grid gap-3">
        <legend className="mb-2 font-display text-xl font-extrabold">Pilares de conteúdo</legend>
        <p className="-mt-1 text-sm text-muted">Os grandes temas do perfil. Toda ideia gerada é encaixada em um deles.</p>
        {pilares.map((p, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-start">
            <input
              id={`pilar-nome-${i}`}
              aria-label={`Nome do pilar ${i + 1}`}
              value={p.nome}
              maxLength={40}
              onChange={(e) => alterarPilar(i, "nome", e.target.value)}
              placeholder="Ex.: Educação financeira"
              className={campo}
            />
            <input
              id={`pilar-descricao-${i}`}
              aria-label={`Descrição do pilar ${i + 1}`}
              value={p.descricao}
              maxLength={240}
              onChange={(e) => alterarPilar(i, "descricao", e.target.value)}
              placeholder="O que entra neste pilar"
              className={campo}
            />
            <button
              type="button"
              onClick={() => setPilares((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [{ nome: "", descricao: "" }]))}
              className="rounded-md px-2 py-2 text-sm text-muted hover:text-danger"
              aria-label={`Remover pilar ${i + 1}`}
            >
              Remover
            </button>
          </div>
        ))}
        {pilares.length < 6 && (
          <button
            type="button"
            onClick={() => setPilares((ps) => [...ps, { nome: "", descricao: "" }])}
            className="justify-self-start rounded-md border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            + Adicionar pilar
          </button>
        )}
      </fieldset>

      <fieldset disabled={!podeEditar || pendente} className="grid gap-4">
        <legend className="mb-2 font-display text-xl font-extrabold">Posicionamento</legend>
        <p className="-mt-1 text-sm text-muted">Quanto mais concreto, melhor a IA escreve no tom de quem assina o perfil.</p>
        {PERGUNTAS_POSICIONAMENTO.map((q, i) => {
          const v = respostas[q.id] ?? "";
          const ok = v.trim().length >= MIN_RESPOSTA;
          return (
            <label key={q.id} className="grid gap-1 text-sm font-medium">
              <span>
                <span className="text-muted">{i + 1}.</span> {q.texto}
              </span>
              <textarea
                id={`pergunta-${q.id}`}
                rows={3}
                maxLength={2000}
                value={v}
                onChange={(e) => setRespostas((r) => ({ ...r, [q.id]: e.target.value }))}
                className={campo}
              />
              <span className={`text-xs ${ok ? "text-ok" : "text-muted"}`}>
                {ok ? "Respondida" : `Mínimo de ${MIN_RESPOSTA} caracteres para contar`}
              </span>
            </label>
          );
        })}
      </fieldset>

      {podeEditar && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-bg py-3">
          <button type="submit" disabled={pendente} className="rounded-md bg-accent px-5 py-2 font-semibold text-accent-ink disabled:opacity-60">
            {pendente ? "Salvando…" : "Salvar posicionamento"}
          </button>
          <span aria-live="polite" className="text-sm">
            {status && <span className={status.tipo === "ok" ? "text-ok" : "text-danger"}>{status.msg}</span>}
          </span>
        </div>
      )}
    </form>
  );
}
