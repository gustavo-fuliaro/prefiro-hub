import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoLeads } from "@/lib/dados-leads";
import { CAMPOS_FORMULARIO, type Formulario } from "@/lib/formularios";
import { createClient } from "@/lib/supabase/server";
import { EditorFormulario } from "./editor";

export const metadata: Metadata = { title: "Editar formulário" };
export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const ctx = await contextoLeads();
  if (!ctx) return null;
  if (!Number.isInteger(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("formularios").select(CAMPOS_FORMULARIO).eq("id", id).maybeSingle<Formulario>();
  if (!data) notFound();
  return <EditorFormulario ctx={ctx} inicial={data} />;
}
