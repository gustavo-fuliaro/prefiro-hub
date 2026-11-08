import type { Metadata } from "next";
import { contextoLeads } from "@/lib/dados-leads";
import { CAMPOS_LEAD, type Lead } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";
import { ListaLeads } from "../lista";

export const metadata: Metadata = { title: "Base Geral · Leads" };

export default async function BasePage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const busca = await searchParams;
  const ctx = await contextoLeads();
  if (!ctx) return null;
  const fixas = ctx.etapas.filter((e) => e.papel === "reservatorio" || e.papel === "terminal").map((e) => e.id);
  const supabase = await createClient();
  const { data } = await supabase.from("leads").select(CAMPOS_LEAD).in("etapa_id", fixas).limit(5000).returns<Lead[]>();
  return <ListaLeads ctx={ctx} iniciais={data ?? []} modo="base" abrir={Number(busca.lead) || null} />;
}
