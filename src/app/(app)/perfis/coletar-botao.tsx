"use client";

import { useActionState } from "react";
import { coletarAgora, type EstadoColeta } from "./coleta-actions";

export function ColetarBotao({ perfilId, rotulo = "Coletar agora" }: { perfilId?: number; rotulo?: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoColeta, FormData>(coletarAgora, {});
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      {perfilId && <input type="hidden" name="perfil_id" value={perfilId} />}
      <button
        type="submit"
        disabled={pendente}
        className="rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft disabled:opacity-60"
      >
        {pendente ? "Coletando…" : rotulo}
      </button>
      <span aria-live="polite" className="text-sm">
        {estado.erro && <span className="text-danger">{estado.erro}</span>}
        {estado.ok && <span className="text-ok">{estado.ok}</span>}
      </span>
    </form>
  );
}
