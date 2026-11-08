import type { Metadata } from "next";
import { contextoLeads } from "@/lib/dados-leads";
import { CAMPOS_LEAD, etapaFollowUp, type Lead } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";
import { ListaLeads } from "../lista";

export const metadata: Metadata = { title: "Follow-up · Leads" };

export default async function FollowUpPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const busca = await searchParams;
  const ctx = await contextoLeads();
  if (!ctx) return null;
  const etapa = etapaFollowUp(ctx.etapas);
  const supabase = await createClient();
  const { data } = etapa
    ? await supabase.from("leads").select(CAMPOS_LEAD).eq("etapa_id", etapa.id).limit(5000).returns<Lead[]>()
    : { data: [] as Lead[] };
  return <ListaLeads ctx={ctx} iniciais={data ?? []} modo="followup" abrir={Number(busca.lead) || null} />;
}
