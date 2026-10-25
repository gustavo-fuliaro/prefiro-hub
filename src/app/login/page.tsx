import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Prefiro Hub</h1>
        <p className="mt-1 text-sm text-muted">Entre com o e-mail cadastrado pela equipe.</p>
        <LoginForm />
      </div>
    </main>
  );
}
