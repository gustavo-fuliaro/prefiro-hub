import type { Metadata } from "next";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { contextoLeads } from "@/lib/dados-leads";
import { CAMPOS_FORMULARIO, type Formulario } from "@/lib/formularios";
import { createClient } from "@/lib/supabase/server";
import { ListaFormularios } from "./lista";

export const metadata: Metadata = { title: "Iscas Digitais" };
export const dynamic = "force-dynamic";

export default async function IscasDigitaisPage() {
  const ctx = await contextoLeads();
  if (!ctx) return null;
  const supabase = await createClient();
  const [{ data: forms }, { data: respostas }] = await Promise.all([
    supabase.from("formularios").select(CAMPOS_FORMULARIO).order("atualizado_em", { ascending: false }).returns<Formulario[]>(),
    supabase.from("formulario_respostas").select("formulario_id, concluido_em").limit(50000).returns<{ formulario_id: number; concluido_em: string | null }[]>(),
  ]);
  const contagem: Record<number, { concluidas: number; parciais: number }> = {};
  for (const r of respostas ?? []) {
    const c = (contagem[r.formulario_id] ??= { concluidas: 0, parciais: 0 });
    if (r.concluido_em) c.concluidas++;
    else c.parciais++;
  }
  return (
    <div className="grid max-w-5xl gap-6">
      <header>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Iscas Digitais</h1>
        <p className="mt-1 text-muted">
          Formulários no estilo Typeform para captar leads: cada resposta pode entrar direto no funil de Leads, com a etiqueta do formulário.
        </p>
      </header>
      <SeletorPerfil perfis={ctx.perfis} atual={ctx.perfilAtual} />
      <ListaFormularios ctx={ctx} iniciais={forms ?? []} contagem={contagem} />
    </div>
  );
}
