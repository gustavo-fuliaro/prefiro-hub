"use server";

import { revalidatePath } from "next/cache";
import { lerFormMeta } from "@/lib/comparativo";
import { hojeSP } from "@/lib/dados-comparativo";
import { createClient } from "@/lib/supabase/server";

export type EstadoMeta = { erro?: string; ok?: string };

// Valor atual da métrica, gravado como ponto de partida da meta.
async function valorAtual(perfilId: number, metrica: string): Promise<number | null> {
  if (metrica === "posts_mes") return 0;
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis_resumo")
    .select("seguidores, engajamento_pct")
    .eq("id", perfilId)
    .maybeSingle<{ seguidores: number | null; engajamento_pct: number | null }>();
  if (!data) return null;
  return metrica === "seguidores" ? data.seguidores : data.engajamento_pct !== null ? Number(data.engajamento_pct) : null;
}

export async function criarMeta(_prev: EstadoMeta, fd: FormData): Promise<EstadoMeta> {
  const hoje = hojeSP();
  const lido = lerFormMeta(fd, hoje);
  if ("erro" in lido) return { erro: lido.erro };
  const base = await valorAtual(lido.dados.perfil_id, lido.dados.metrica);
  if (base !== null && lido.dados.metrica !== "posts_mes" && base >= lido.dados.alvo) {
    return { erro: "O perfil já passou desse alvo. Escolha um valor maior." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("metas").insert({ ...lido.dados, base, inicio: hoje });
  if (error) return { erro: error.code === "42501" ? "Seu papel não permite criar metas." : "Não foi possível salvar a meta." };
  revalidatePath("/metas");
  return { ok: "Meta criada." };
}

export async function excluirMeta(id: number): Promise<EstadoMeta> {
  if (!Number.isInteger(id)) return { erro: "Meta inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("metas").delete().eq("id", id).select("id");
  if (error || !data?.length) return { erro: "Não foi possível excluir. Seu papel pode não permitir." };
  revalidatePath("/metas");
  return { ok: "Meta excluída." };
}
