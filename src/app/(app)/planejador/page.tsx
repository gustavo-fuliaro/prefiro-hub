import type { Metadata } from "next";
import { contextoTarefas } from "@/lib/dados-tarefas";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_TAREFA, type Tarefa } from "@/lib/tarefas";
import { Quadro } from "./quadro";

export const metadata: Metadata = { title: "Planejador" };
export const dynamic = "force-dynamic";

export default async function PlanejadorPage({ searchParams }: { searchParams: Promise<{ tarefa?: string }> }) {
  const busca = await searchParams;
  const ctx = await contextoTarefas();
  if (!ctx) return null;

  const supabase = await createClient();
  const { data: tarefas } = await supabase
    .from("tarefas")
    .select(CAMPOS_TAREFA)
    .is("arquivada_em", null)
    .order("ordem")
    .returns<Tarefa[]>();
  const ids = (tarefas ?? []).map((t) => t.id);
  const { data: comentarios } = ids.length
    ? await supabase.from("tarefa_comentarios").select("id, tarefa_id").in("tarefa_id", ids).returns<{ id: number; tarefa_id: number }[]>()
    : { data: [] };

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Planejador</h1>
          <p className="mt-1 text-muted">A produção de conteúdo do ambiente, do roteiro à publicação. Arraste os cartões entre as etapas.</p>
        </div>
      </header>
      <Quadro ctx={ctx} iniciais={tarefas ?? []} comentarios={comentarios ?? []} abrir={Number(busca.tarefa) || null} />
    </div>
  );
}
