import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoLeads } from "@/lib/dados-leads";
import { CAMPOS_FORMULARIO, type Formulario, type RespostaForm } from "@/lib/formularios";
import { createClient } from "@/lib/supabase/server";
import { TabelaRespostas } from "./tabela";

export const metadata: Metadata = { title: "Respostas do formulário" };
export const dynamic = "force-dynamic";

export default async function RespostasPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const ctx = await contextoLeads();
  if (!ctx) return null;
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const [{ data: form }, { data: respostas }] = await Promise.all([
    supabase.from("formularios").select(CAMPOS_FORMULARIO).eq("id", id).maybeSingle<Formulario>(),
    supabase
      .from("formulario_respostas")
      .select("id, respostas, origem, iniciado_em, concluido_em, qualificado, lead_id, lead_status, lead_erro")
      .eq("formulario_id", id)
      .order("iniciado_em", { ascending: false })
      .limit(5000)
      .returns<RespostaForm[]>(),
  ]);
  if (!form) notFound();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, handle")
    .in("id", [...new Set((respostas ?? []).map((r) => r.lead_id).filter((x): x is number => !!x))])
    .returns<{ id: number; handle: string }[]>();
  return <TabelaRespostas ctx={ctx} form={form} iniciais={respostas ?? []} leads={leads ?? []} />;
}
