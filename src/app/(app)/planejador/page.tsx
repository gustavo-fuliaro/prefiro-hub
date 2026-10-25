import type { Metadata } from "next";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { estudioLiberado } from "@/lib/config";
import { escolherPerfil, listarIdeias, listarPerfisAtivos, listarPostsRecentes } from "@/lib/dados-planejador";
import { membroAtual, podeEditarConteudo } from "@/lib/membro";
import { Quadro } from "./quadro";

export const metadata: Metadata = { title: "Planejador" };

export default async function PlanejadorPage({ searchParams }: { searchParams: Promise<{ perfil?: string; ideia?: string }> }) {
  const busca = await searchParams;
  const { membro } = await membroAtual();
  const perfis = await listarPerfisAtivos();
  const perfil = escolherPerfil(perfis, busca.perfil);

  if (!perfil) {
    return (
      <div className="max-w-xl rounded-xl border border-dashed border-line px-6 py-10 text-center">
        <p className="font-medium">Cadastre um perfil para começar a planejar.</p>
        <p className="mt-1 text-sm text-muted">O planejador organiza as ideias de conteúdo de cada perfil.</p>
      </div>
    );
  }

  const [ideias, posts, iaLiberada] = await Promise.all([listarIdeias(perfil.id), listarPostsRecentes(perfil.id), estudioLiberado()]);
  const pilares = [...new Set(ideias.map((i) => i.pilar).filter((p): p is string => !!p))].sort();

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Planejador</h1>
          <p className="mt-1 text-muted">Arraste os cards entre as colunas ou use as setas. Clique em um card para editar.</p>
        </div>
        <SeletorPerfil perfis={perfis} atual={perfil.handle} base="/planejador" />
      </header>
      <Quadro
        key={perfil.id}
        perfil={perfil}
        ideiasIniciais={ideias}
        posts={posts}
        pilares={pilares}
        podeEditar={podeEditarConteudo(membro?.papel)}
        abrirIdeia={Number(busca.ideia) || null}
        iaLiberada={iaLiberada}
      />
    </div>
  );
}
