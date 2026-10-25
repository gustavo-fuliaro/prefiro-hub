"use client";

import { useState, useTransition } from "react";
import { definirCadeadoEstudio } from "./actions";

const Icone = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

// Aviso mostrado no lugar do gerador enquanto o Estúdio está bloqueado.
export function EstudioBloqueado({ admin }: { admin: boolean }) {
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <section className="grid gap-3 rounded-balao border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted"><Icone /></span>
        <div>
          <h2 className="font-display text-lg font-bold">Estúdio bloqueado</h2>
          <p className="mt-1 text-sm text-muted">
            A geração com IA está desligada até a conta da Anthropic ter créditos. Os materiais já gerados continuam disponíveis abaixo.
          </p>
        </div>
      </div>
      {admin && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
          {!confirmar ? (
            <button type="button" onClick={() => setConfirmar(true)} className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-accent">
              Liberar Estúdio
            </button>
          ) : (
            <>
              <span>Já comprou créditos na Anthropic?</span>
              <button
                type="button"
                disabled={pendente}
                onClick={() => iniciar(async () => { const r = await definirCadeadoEstudio(true); if (r.erro) setErro(r.erro); })}
                className="rounded-md bg-accent px-3 py-1.5 font-semibold text-accent-ink disabled:opacity-60"
              >
                {pendente ? "Liberando…" : "Sim, liberar"}
              </button>
              <button type="button" onClick={() => setConfirmar(false)} className="text-muted hover:underline">Cancelar</button>
            </>
          )}
          <span className="text-xs text-muted">Só admins veem este botão.</span>
        </div>
      )}
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
    </section>
  );
}

// Botão discreto para o admin voltar a bloquear.
export function BloquearEstudio() {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => { await definirCadeadoEstudio(false); })}
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink disabled:opacity-60"
    >
      <span className="[&_svg]:size-4"><Icone /></span>
      {pendente ? "Bloqueando…" : "Bloquear Estúdio"}
    </button>
  );
}
