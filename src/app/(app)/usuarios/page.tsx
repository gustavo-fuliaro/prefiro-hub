import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { membroAtual } from "@/lib/membro";
import { chamarGestao } from "./actions";
import { GestaoUsuarios } from "./gestao";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsuariosPage() {
  const { membro } = await membroAtual();
  // Só a conta administradora principal enxerga esta área. A Edge Function faz a mesma checagem.
  if (!membro?.super_admin || !membro.ativo) notFound();

  const r = await chamarGestao({ acao: "listar" });

  return (
    <div className="grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Usuários</h1>
          <p className="mt-1 text-muted">
            Cada usuário tem um ambiente próprio, com perfis, métricas, relatórios e alertas só dele. Daqui você libera, bloqueia e gerencia o acesso, sem ver os dados dos outros ambientes.
          </p>
        </div>
      </header>
      {r.erro ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">{r.erro}</p>
      ) : (
        <GestaoUsuarios usuarios={r.usuarios ?? []} eu={membro.user_id} />
      )}
    </div>
  );
}
