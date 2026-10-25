"use client";

import { useState, useTransition } from "react";
import { excluirMeta } from "./actions";

export function ExcluirMeta({ id }: { id: number }) {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (!confirmar) {
    return (
      <button type="button" onClick={() => setConfirmar(true)} className="text-xs text-muted hover:text-danger">
        Excluir
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      {erro ? <span className="text-danger">{erro}</span> : "Excluir meta?"}
      <button
        type="button"
        disabled={pendente}
        onClick={() => iniciar(async () => { const r = await excluirMeta(id); if (r.erro) setErro(r.erro); })}
        className="font-semibold text-danger"
      >
        Sim
      </button>
      <button type="button" onClick={() => setConfirmar(false)} className="text-muted">Não</button>
    </span>
  );
}
