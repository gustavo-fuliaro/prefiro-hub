import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { marcarLido, marcarTodosLidos } from "./actions";

export const metadata: Metadata = { title: "Alertas" };

type Alerta = {
  id: number;
  tipo: string;
  mensagem: string;
  severidade: "info" | "atencao" | "critico";
  link: string | null;
  lido: boolean;
  criado_em: string;
};

const TIPO: Record<string, string> = {
  queda_seguidores: "Queda de seguidores",
  post_destaque: "Post em destaque",
  meta_em_risco: "Meta fora do ritmo",
  coleta_erro: "Falha na coleta",
  relatorio_semanal: "Relatório semanal",
};
const COR: Record<Alerta["severidade"], string> = {
  critico: "bg-danger-soft text-danger",
  atencao: "bg-warn-soft text-warn",
  info: "bg-accent-soft text-accent-strong",
};
const PONTO: Record<Alerta["severidade"], string> = { critico: "bg-danger", atencao: "bg-warn", info: "bg-accent" };
const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AlertasPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const todos = (await searchParams).ver === "todos";
  const supabase = await createClient();
  let q = supabase.from("alertas").select("id, tipo, mensagem, severidade, link, lido, criado_em").order("criado_em", { ascending: false }).limit(200);
  if (!todos) q = q.eq("lido", false);
  const { data } = await q.returns<Alerta[]>();
  const alertas = data ?? [];

  return (
    <div className="grid max-w-4xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Alertas</h1>
          <p className="mt-1 text-muted">Gerados todo dia às 06:20, depois da coleta.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={todos ? "/alertas" : "/alertas?ver=todos"} className="text-accent-strong hover:underline">
            {todos ? "Ver só não lidos" : "Ver todos"}
          </Link>
          {!todos && alertas.length > 0 && (
            <form action={marcarTodosLidos}>
              <button type="submit" className="rounded-md border border-line px-3 py-1.5 hover:border-accent">Marcar todos como lidos</button>
            </form>
          )}
        </div>
      </header>

      {alertas.length === 0 ? (
        <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-muted">
          {todos ? "Nenhum alerta ainda." : "Nenhum alerta não lido."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {alertas.map((a) => (
            <li key={a.id} className={`flex flex-wrap items-start gap-3 rounded-balao border border-line bg-surface p-4 shadow-card ${a.lido ? "opacity-60" : ""}`}>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR[a.severidade]}`}>
                <span aria-hidden className={`size-1.5 rounded-full ${PONTO[a.severidade]}`} />
                {TIPO[a.tipo] ?? a.tipo}
              </span>
              <div className="min-w-0 flex-1">
                <p>{a.mensagem}</p>
                <p className="mt-1 text-xs text-muted">{quando.format(new Date(a.criado_em))}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {a.link && (
                  a.link.startsWith("/")
                    ? <Link href={a.link} className="text-accent-strong hover:underline">Abrir</Link>
                    : <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">Abrir post</a>
                )}
                <form action={marcarLido.bind(null, a.id, !a.lido)}>
                  <button type="submit" className="text-muted hover:text-ink">{a.lido ? "Marcar não lido" : "Marcar lido"}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
