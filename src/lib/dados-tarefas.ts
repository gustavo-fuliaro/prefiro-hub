// Dados do Planejador lidos no servidor (respeitando o RLS do ambiente de quem está logado).
import { escolhaDePerfil } from "@/lib/dados-perfis";
import { membroAtual } from "@/lib/membro";
import type { PerfilProprio } from "@/lib/perfis-proprios";
import { createClient } from "@/lib/supabase/server";
import { hojeNoFuso } from "@/lib/tarefas";

export type ContextoServidor = {
  contaId: number;
  eu: string;
  hoje: string;
  fuso: string;
  membros: { user_id: string; nome: string }[];
  podeEditar: boolean;
  podeExcluir: boolean;
  perfis: PerfilProprio[]; // perfis próprios do ambiente
  perfilAtual: number | null; // null = visão em grupo
};

export async function contextoTarefas(): Promise<ContextoServidor | null> {
  const { membro } = await membroAtual();
  if (!membro?.ativo) return null;
  const supabase = await createClient();
  const [{ data: membros }, { data: conta }, escolha] = await Promise.all([
    supabase.from("membros").select("user_id, nome").eq("conta_id", membro.conta_id).eq("ativo", true).order("nome"),
    supabase.from("contas").select("fuso").eq("id", membro.conta_id).maybeSingle<{ fuso: string }>(),
    escolhaDePerfil(),
  ]);
  const fuso = conta?.fuso ?? "America/Sao_Paulo";
  return {
    contaId: membro.conta_id,
    eu: membro.user_id,
    hoje: hojeNoFuso(fuso),
    fuso,
    membros: (membros ?? []) as { user_id: string; nome: string }[],
    podeEditar: ["admin", "estrategista", "criador"].includes(membro.papel),
    podeExcluir: ["admin", "estrategista"].includes(membro.papel),
    perfis: escolha.perfis,
    perfilAtual: escolha.perfilAtual,
  };
}
