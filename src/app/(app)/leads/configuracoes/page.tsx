import type { Metadata } from "next";
import { contextoLeads } from "@/lib/dados-leads";
import { createClient } from "@/lib/supabase/server";
import { EditorFunil } from "./editor";

export const metadata: Metadata = { title: "Configurações · Leads" };

export default async function ConfiguracoesLeadsPage({ searchParams }: { searchParams: Promise<{ salvo?: string }> }) {
  const { salvo } = await searchParams;
  const ctx = await contextoLeads();
  if (!ctx) return null;
  if (!ctx.perm.admin) return <p className="text-muted">Só admins configuram o funil.</p>;
  // Quantos leads há em cada coluna (coluna com lead não pode ser removida).
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select("etapa_id").eq("pipeline_id", ctx.pipeline.id).limit(10000).returns<{ etapa_id: number }[]>();
  const contagem: Record<number, number> = {};
  for (const l of data ?? []) contagem[l.etapa_id] = (contagem[l.etapa_id] ?? 0) + 1;
  return <EditorFunil key={ctx.etapas.map((e) => `${e.id}:${e.posicao}:${e.prazo_h}`).join(",")} ctx={ctx} contagem={contagem} salvo={salvo === "1"} />;
}
