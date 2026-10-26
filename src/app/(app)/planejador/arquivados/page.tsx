import type { Metadata } from "next";
import Link from "next/link";
import { IconeAnterior } from "@/components/icones";
import { contextoTarefas } from "@/lib/dados-tarefas";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_TAREFA, type Tarefa } from "@/lib/tarefas";
import { ListaArquivados } from "./lista";

export const metadata: Metadata = { title: "Tarefas arquivadas" };
export const dynamic = "force-dynamic";

export default async function ArquivadosPage() {
  const ctx = await contextoTarefas();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select(CAMPOS_TAREFA)
    .not("arquivada_em", "is", null)
    .order("arquivada_em", { ascending: false })
    .limit(2000)
    .returns<Tarefa[]>();

  return (
    <div className="grid max-w-5xl gap-5">
      <header className="grid gap-2">
        <Link href="/planejador" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-ink">
          <IconeAnterior /> Planejador
        </Link>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Arquivados</h1>
        <p className="text-muted">
          Tarefas tiradas do quadro. As publicadas vêm para cá sozinhas 7 dias depois da publicação. Comentários e histórico ficam guardados.
        </p>
      </header>
      <ListaArquivados ctx={ctx} iniciais={data ?? []} />
    </div>
  );
}
