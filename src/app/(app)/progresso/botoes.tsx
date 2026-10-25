"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { gerarRelatorio } from "./actions";

export function GerarRelatorio({ inicio, rotulo }: { inicio: string; rotulo: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const r = await gerarRelatorio(inicio);
            if (r.erro) setErro(r.erro);
            else router.push(`/progresso?semana=${inicio}`);
          })
        }
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {pendente ? "Gerando…" : rotulo}
      </button>
      {erro && <span role="alert" className="text-sm text-danger">{erro}</span>}
    </span>
  );
}

export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent">
      Imprimir ou salvar PDF
    </button>
  );
}
