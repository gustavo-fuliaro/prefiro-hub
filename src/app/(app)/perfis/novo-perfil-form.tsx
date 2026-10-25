"use client";

import { useActionState, useEffect, useRef } from "react";
import { GRUPOS } from "@/lib/perfis";
import { adicionarPerfil, type EstadoForm } from "./actions";

export function NovoPerfilForm() {
  const [estado, enviar, pendente] = useActionState<EstadoForm, FormData>(adicionarPerfil, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={enviar} className="grid gap-3 rounded-xl border border-line bg-surface p-5 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
      <label className="grid gap-1 text-sm font-medium">
        @ ou link do perfil
        <input id="handle" name="handle" required placeholder="@prefiroconsorcio" className="rounded-md border border-line bg-bg px-3 py-2 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Nome (opcional)
        <input id="nome" name="nome" placeholder="Prefiro Consórcio" className="rounded-md border border-line bg-bg px-3 py-2 font-normal" />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Grupo
        <select id="grupo" name="grupo" defaultValue="concorrente" className="rounded-md border border-line bg-bg px-3 py-2 font-normal">
          {Object.entries(GRUPOS).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pendente} className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60">
        {pendente ? "Salvando…" : "Adicionar"}
      </button>
      <p aria-live="polite" className="text-sm md:col-span-4">
        {estado.erro && <span className="text-danger">{estado.erro}</span>}
        {estado.ok && <span className="text-accent">{estado.ok}</span>}
      </p>
    </form>
  );
}
