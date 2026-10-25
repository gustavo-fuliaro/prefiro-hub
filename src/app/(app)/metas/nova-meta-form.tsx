"use client";

import { useActionState, useEffect, useRef } from "react";
import { METRICAS_META } from "@/lib/comparativo";
import { criarMeta, type EstadoMeta } from "./actions";

const campo = "rounded-md border border-line bg-bg px-3 py-2 font-normal";

export function NovaMetaForm({ perfis, amanha }: { perfis: { id: number; handle: string }[]; amanha: string }) {
  const [estado, enviar, pendente] = useActionState<EstadoMeta, FormData>(criarMeta, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);

  return (
    <form ref={ref} action={enviar} className="grid gap-3 rounded-xl border border-line bg-surface p-5 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto] md:items-end">
      <label className="grid gap-1 text-sm font-medium">
        Perfil
        <select id="meta-perfil" name="perfil_id" required className={campo}>
          {perfis.map((p) => (
            <option key={p.id} value={p.id}>@{p.handle}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Métrica
        <select id="meta-metrica" name="metrica" defaultValue="seguidores" className={campo}>
          {Object.entries(METRICAS_META).map(([v, m]) => (
            <option key={v} value={v}>{m.rotulo}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Alvo
        <input id="meta-alvo" name="alvo" required inputMode="decimal" placeholder="Ex.: 20.000" className={campo} />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Prazo
        <input id="meta-prazo" name="prazo" type="date" required min={amanha} className={campo} />
      </label>
      <button type="submit" disabled={pendente} className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60">
        {pendente ? "Salvando…" : "Criar meta"}
      </button>
      <p aria-live="polite" className="text-sm md:col-span-5">
        {estado.erro && <span className="text-danger">{estado.erro}</span>}
        {estado.ok && <span className="text-ok">{estado.ok}</span>}
      </p>
    </form>
  );
}
