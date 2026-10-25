import type { Metadata } from "next";
import { Balao, Estrela, Logotipo } from "@/components/marca";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

// Mosaico com os elementos visuais do manual (balão, estrela, quarto de círculo, linhas, onda), só decorativo.
function Mosaico() {
  const peca = "mosaico-peca";
  return (
    <div aria-hidden className="relative hidden overflow-hidden bg-grad p-10 lg:block">
      <div className="mx-auto grid h-full max-h-[760px] max-w-xl grid-cols-6 grid-rows-6 gap-4">
        <div className={`${peca} col-span-3 row-span-2 rounded-[0_0_100%_0] bg-[#424241]`} style={{ animationDelay: "0ms" }} />
        <div className={`${peca} col-span-3 row-span-2 rounded-[0_0_0_100%] bg-[#666666]`} style={{ animationDelay: "60ms" }} />
        <div className={`${peca} col-span-3 row-span-2 grid place-items-center`} style={{ animationDelay: "120ms" }}>
          <Balao className="h-full max-h-56 w-auto text-[#faf8f5]" />
        </div>
        <div className={`${peca} col-span-3 row-span-2 rounded-[2.5rem_2.5rem_2.5rem_0.4rem] bg-[#ff7b00]`} style={{ animationDelay: "180ms" }} />
        <div className={`${peca} col-span-2 row-span-2 rounded-[0_100%_0_0] bg-[#424241]`} style={{ animationDelay: "240ms" }} />
        <div className={`${peca} col-span-2 row-span-2 grid place-items-center`} style={{ animationDelay: "300ms" }}>
          <Estrela className="size-28 text-[#ffd8b3]" />
        </div>
        <div className={`${peca} col-span-2 row-span-2 flex flex-col justify-center gap-3 px-2`} style={{ animationDelay: "360ms" }}>
          <span className="h-3 rounded-full bg-[#ffd8b3]" />
          <span className="h-3 rounded-full bg-[#ffd8b3]" />
          <span className="h-3 w-2/3 rounded-full bg-[#ffd8b3]" />
        </div>
      </div>
      <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full">
        <path d="M0 70 C 120 20, 240 110, 360 64 S 540 30, 600 56 V120 H0 Z" fill="#666666" />
        <path d="M0 92 C 140 52, 260 124, 400 86 S 560 70, 600 82 V120 H0 Z" fill="#424241" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="entrada-pagina mx-auto w-full max-w-sm">
          <Logotipo largura={170} className="h-auto w-[150px] sm:w-[170px]" />
          <h1 className="mt-12 font-display text-3xl font-bold tracking-tight text-ink">Prefiro Hub</h1>
          <p className="mt-2 text-muted">Entre com o e-mail cadastrado pela equipe.</p>
          <LoginForm />
        </div>
      </div>
      <Mosaico />
    </main>
  );
}
