"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
    <form onSubmit={entrar} className="mt-6 grid gap-4">
      <label className="grid gap-1 text-sm font-medium">
        E-mail
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-line bg-bg px-3 py-2 font-normal"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Senha
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-line bg-bg px-3 py-2 font-normal"
        />
      </label>
      {erro && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
