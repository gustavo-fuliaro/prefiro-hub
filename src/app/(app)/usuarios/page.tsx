import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { membroAtual } from "@/lib/membro";
import { chamarGestao } from "./actions";
import { GestaoUsuarios } from "./gestao";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const { membro } = await membroAtual();
  // Conta principal (todos os ambientes) ou admin do ambiente (só a própria equipe). A Edge Function faz a mesma checagem.
  if (!membro?.ativo || !(membro.super_admin || membro.papel === "admin")) notFound();

  const r = await chamarGestao({ acao: "listar" });

  return (
    <div className="grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-muted">
            {membro.super_admin
              ? "Cadastre a equipe do seu ambiente ou crie ambientes novos e isolados para outras empresas. Daqui você libera, bloqueia e gerencia o acesso, sem ver os dados dos outros ambientes."
              : "Cadastre e gerencie a equipe do seu ambiente. Todos da equipe veem os mesmos perfis, tarefas e relatórios, cada um com o seu papel."}
          </p>
        </div>
      </header>
      {r.erro ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">{r.erro}</p>
      ) : (
        <GestaoUsuarios usuarios={r.usuarios ?? []} eu={membro.user_id} superAdmin={membro.super_admin} minhaConta={membro.conta_id} />
      )}
    </div>
  );
}
