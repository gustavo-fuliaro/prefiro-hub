import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logotipo } from "@/components/marca";
import { membroAtual } from "@/lib/membro";
import { TrocarSenhaForm } from "./form";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function TrocarSenhaPage() {
  const { email, membro } = await membroAtual();
  if (!membro?.ativo) redirect("/perfis");
  const obrigatoria = membro.deve_trocar_senha;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 py-12">
      <div className="entrada-pagina w-full max-w-sm">
        <Logotipo largura={150} className="h-auto w-[150px]" />
        <h1 className="mt-12 font-display text-3xl font-bold tracking-tight">{obrigatoria ? "Crie sua senha" : "Trocar senha"}</h1>
        <p className="mt-2 text-muted">
          {obrigatoria
            ? `Você entrou com uma senha provisória (${email}). Defina uma senha só sua para continuar.`
            : `Defina uma nova senha para ${email}.`}
        </p>
        <TrocarSenhaForm />
        {!obrigatoria && (
          <Link href="/perfis" className="mt-6 inline-block text-sm text-muted hover:text-ink hover:underline">
            Voltar sem trocar
          </Link>
        )}
      </div>
    </main>
  );
}
