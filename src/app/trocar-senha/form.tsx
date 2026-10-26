"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { problemaSenha } from "@/lib/usuarios";
import { confirmarTroca } from "./actions";

const campo = "h-11 rounded-md border border-line bg-surface px-3 font-normal text-ink";

export function TrocarSenhaForm() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nova = String(form.get("nova") ?? "");
    const confirma = String(form.get("confirma") ?? "");
    const problema = problemaSenha(nova);
    if (problema) return setErro(problema);
    if (nova !== confirma) return setErro("As duas senhas não são iguais.");

    setEnviando(true);
    setErro(null);
    const { error } = await createClient().auth.updateUser({ password: nova });
    if (error) {
      setEnviando(false);
      return setErro(
        /different|same/i.test(error.message)
          ? "A nova senha precisa ser diferente da atual."
          : "Não foi possível trocar a senha. Tente de novo.",
      );
    }
    const r = await confirmarTroca();
    if (r?.erro) {
      setEnviando(false);
      setErro(r.erro);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-8 grid gap-5">
      <label className="grid gap-1.5 text-sm font-medium">
        Nova senha
        <input id="nova" name="nova" type="password" autoComplete="new-password" required minLength={10} className={campo} />
        <span className="text-xs font-normal text-muted">Pelo menos 10 caracteres, com letras e números.</span>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Repita a nova senha
        <input id="confirma" name="confirma" type="password" autoComplete="new-password" required className={campo} />
      </label>
      {erro && (
        <p role="alert" className="rounded-balao-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      <button type="submit" disabled={enviando} className="mt-1 h-11 rounded-balao-sm bg-accent px-4 font-semibold text-accent-ink hover:brightness-105 disabled:opacity-60">
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
