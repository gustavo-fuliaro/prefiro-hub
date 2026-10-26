"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { gerarRelatorioPeriodo } from "./actions";

// Relatório personalizado: escolhe o intervalo e gera na hora, sem mexer nos semanais.
export function GerarPeriodo({ hoje }: { hoje: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = "h-9 rounded-md border border-line bg-surface px-2.5 text-sm";
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const de = String(fd.get("de") ?? "");
        const ate = String(fd.get("ate") ?? "");
        iniciar(async () => {
          setErro(null);
          const r = await gerarRelatorioPeriodo(de, ate);
          if (r.erro) setErro(r.erro);
          else router.push(`/progresso?relatorio=${r.id}`);
        });
      }}
    >
      <label className="grid gap-1 text-xs font-medium text-muted">
        De
        <input name="de" type="date" required max={hoje} className={campo} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted">
        Até
        <input name="ate" type="date" required max={hoje} defaultValue={hoje} className={campo} />
      </label>
      <button type="submit" disabled={pendente} className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-60">
        {pendente ? "Gerando…" : "Gerar relatório do período"}
      </button>
      {erro && <span role="alert" className="w-full text-sm text-danger">{erro}</span>}
    </form>
  );
}

export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="h-9 rounded-md border border-line px-3 text-sm hover:border-accent">
      Imprimir ou salvar PDF
    </button>
  );
}
