"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const campo = "h-11 rounded-md border border-line bg-surface px-3 font-normal text-ink";

export function LoginForm() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setEnviando(true);
    setErro(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("senha") ?? ""),
    });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setEnviando(false);
      return;
    }
    router.replace("/perfis");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="mt-8 grid gap-5">
      <label className="grid gap-1.5 text-sm font-medium">
        E-mail
        <input id="email" name="email" type="email" autoComplete="email" required className={campo} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Senha
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className={campo} />
      </label>
      {erro && (
        <p role="alert" className="rounded-balao-sm bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-1 h-11 rounded-balao-sm bg-accent px-4 font-semibold text-accent-ink hover:brightness-105 disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
