import type { Metadata } from "next";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { escolherPerfil, listarPerfisAtivos } from "@/lib/dados-planejador";
import type { Posicionamento } from "@/lib/estudio";
import { membroAtual, podeEditarCadastro } from "@/lib/membro";
import { createClient } from "@/lib/supabase/server";
import { PosicionamentoForm } from "./posicionamento-form";

export const metadata: Metadata = { title: "Estratégia" };

export default async function EstrategiaPage({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const busca = await searchParams;
  const { membro } = await membroAtual();
  const perfis = (await listarPerfisAtivos()).filter((p) => p.grupo === "proprio");
  const perfil = escolherPerfil(perfis, busca.perfil);
  if (!perfil) return <p className="text-muted">Cadastre um perfil próprio para definir o posicionamento.</p>;

  const supabase = await createClient();
  const { data } = await supabase
    .from("posicionamento")
    .select("respostas, pilares")
    .eq("perfil_id", perfil.id)
    .maybeSingle<Posicionamento>();

  return (
    <div className="grid max-w-4xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Estratégia</h1>
          <p className="mt-1 text-muted">Pilares e posicionamento de cada perfil próprio. O estúdio de IA usa estas respostas em toda geração.</p>
        </div>
        <SeletorPerfil perfis={perfis} atual={perfil.handle} base="/estrategia" />
      </header>
      <PosicionamentoForm
        key={perfil.id}
        perfilId={perfil.id}
        inicial={{ respostas: data?.respostas ?? {}, pilares: data?.pilares ?? [] }}
        podeEditar={podeEditarCadastro(membro?.papel)}
      />
    </div>
  );
}
