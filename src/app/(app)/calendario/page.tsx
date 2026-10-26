import type { Metadata } from "next";
import { deslocarMes, gradeDoMes, lerMes } from "@/lib/calendario";
import { contextoTarefas } from "@/lib/dados-tarefas";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_TAREFA, type Tarefa } from "@/lib/tarefas";
import { CalendarioTarefas } from "./calendario";

export const metadata: Metadata = { title: "Calendário" };
export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ mes?: string; visao?: string }> }) {
  const busca = await searchParams;
  const ctx = await contextoTarefas();
  if (!ctx) return null;
  const mes = lerMes(busca.mes, ctx.hoje);
  const grade = gradeDoMes(mes, ctx.hoje);
  const inicio = grade[0][0].data;
  const fim = grade.at(-1)!.at(-1)!.data;

  // Tarefas com data de publicação na grade do mês, inclusive arquivadas: o calendário registra o que saiu.
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarefas")
    .select(CAMPOS_TAREFA)
    .gte("data_publicacao", inicio)
    .lte("data_publicacao", fim)
    .order("data_publicacao")
    .order("ordem")
    .returns<Tarefa[]>();

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Calendário de publicação</h1>
        <p className="mt-1 text-muted">Tarefas do Planejador com data de publicação. Clique numa tarefa para ver os detalhes.</p>
      </header>
      <CalendarioTarefas
        ctx={ctx}
        mes={mes}
        anterior={deslocarMes(mes, -1)}
        proximo={deslocarMes(mes, 1)}
        grade={grade}
        visao={busca.visao === "lista" ? "lista" : "mes"}
        iniciais={data ?? []}
      />
    </div>
  );
}
