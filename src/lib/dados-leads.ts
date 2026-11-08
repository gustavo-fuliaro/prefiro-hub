// Dados das telas de Leads lidos no servidor (respeitando o RLS do ambiente de quem está logado).
import { escolhaDePerfil } from "@/lib/dados-perfis";
import { CAMPOS_ETAPA, CAMPOS_PIPELINE, papelLeads, type Etapa, type PermissaoLeads, type Pipeline } from "@/lib/leads";
import { membroAtual } from "@/lib/membro";
import type { PerfilProprio } from "@/lib/perfis-proprios";
import { createClient } from "@/lib/supabase/server";
import { hojeNoFuso } from "@/lib/tarefas";

export type ContextoLeads = {
  contaId: number;
  eu: string;
  fuso: string;
  hoje: string;
  membros: { user_id: string; nome: string }[];
  perfis: PerfilProprio[];
  perfilAtual: number | null;
  perm: PermissaoLeads;
  pipeline: Pipeline;
  etapas: Etapa[];
};

export async function contextoLeads(): Promise<ContextoLeads | null> {
  const { membro } = await membroAtual();
  if (!membro?.ativo) return null;
  const supabase = await createClient();
  const [{ data: membros }, { data: conta }, { data: pipeline }, escolha] = await Promise.all([
    supabase.from("membros").select("user_id, nome").eq("conta_id", membro.conta_id).eq("ativo", true).order("nome"),
    supabase.from("contas").select("fuso").eq("id", membro.conta_id).maybeSingle<{ fuso: string }>(),
    // Fase 1: um funil (o de Social Selling, criado para todo ambiente).
    supabase.from("lead_pipelines").select(CAMPOS_PIPELINE).is("arquivado_em", null).order("tipo", { ascending: false }).order("id").limit(1).maybeSingle<Pipeline>(),
    escolhaDePerfil(),
  ]);
  if (!pipeline) return null;
  const { data: etapas } = await supabase.from("lead_etapas").select(CAMPOS_ETAPA).eq("pipeline_id", pipeline.id).order("posicao").returns<Etapa[]>();
  const fuso = conta?.fuso ?? "America/Sao_Paulo";
  return {
    contaId: membro.conta_id,
    eu: membro.user_id,
    fuso,
    hoje: hojeNoFuso(fuso),
    membros: (membros ?? []) as { user_id: string; nome: string }[],
    perfis: escolha.perfis,
    perfilAtual: escolha.perfilAtual,
    perm: papelLeads(membro.super_admin ? "admin" : membro.papel, membro.user_id),
    pipeline,
    etapas: etapas ?? [],
  };
}
