import type { Metadata } from "next";
import { contextoLeads } from "@/lib/dados-leads";
import { CAMPOS_LEAD, type Lead } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";
import { QuadroLeads } from "./quadro";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const busca = await searchParams;
  const ctx = await contextoLeads();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select(CAMPOS_LEAD).eq("pipeline_id", ctx.pipeline.id).limit(5000).returns<Lead[]>();
  return <QuadroLeads ctx={ctx} iniciais={data ?? []} abrir={Number(busca.lead) || null} />;
}
