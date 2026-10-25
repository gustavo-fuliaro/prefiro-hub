"use server";

import { revalidatePath } from "next/cache";
import { FORMATOS } from "@/lib/planejador";
import type { SaidaIdeias } from "@/lib/estudio";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { erro?: string; ok?: string; jobId?: string };

// Abre ou fecha o cadeado do Estúdio. O RLS de hub.config só deixa admin alterar.
export async function definirCadeadoEstudio(liberar: boolean): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("config")
    .update({ valor: liberar, atualizado_em: new Date().toISOString() })
    .eq("chave", "estudio_liberado")
    .select("chave");
  if (error || !data?.length) return { erro: "Só um admin pode mudar o cadeado do Estúdio." };
  revalidatePath("/", "layout");
  return { ok: liberar ? "Estúdio liberado." : "Estúdio bloqueado." };
}

export async function iniciarGeracao(dados: { tipo: string; perfil_id: number; contexto?: string; quantidade?: number; ideia_id?: number }): Promise<Resultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ job_id?: string; erro?: string }>("gerar-conteudo", { body: dados });
  if (error) {
    let msg = "Não foi possível iniciar a geração.";
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.erro) msg = corpo.erro;
    } catch {}
    return { erro: msg };
  }
  return data?.job_id ? { jobId: data.job_id } : { erro: data?.erro ?? "A geração não respondeu." };
}

type Material = { id: number; perfil_id: number; tipo: string; saida: unknown; ideia_id: number | null };

async function carregarMaterial(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("materiais_ia").select("id, perfil_id, tipo, saida, ideia_id").eq("id", id).maybeSingle<Material>();
  return { supabase, material: data };
}

// Cria no planejador (coluna Ideias) as ideias escolhidas de um material gerado.
export async function enviarIdeiasAoPlanejador(materialId: number, indices: number[]): Promise<Resultado> {
  const { supabase, material } = await carregarMaterial(materialId);
  if (!material || material.tipo !== "ideias") return { erro: "Material não encontrado." };
  const todas = (material.saida as SaidaIdeias).ideias ?? [];
  const escolhidas = [...new Set(indices)].filter((i) => Number.isInteger(i) && i >= 0 && i < todas.length).map((i) => todas[i]);
  if (!escolhidas.length) return { erro: "Escolha pelo menos uma ideia." };

  const { data: ultima } = await supabase
    .from("ideias")
    .select("ordem")
    .eq("perfil_id", material.perfil_id)
    .eq("coluna", "garagem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle<{ ordem: number }>();
  const base = ultima?.ordem ?? 0;
  const linhas = escolhidas.map((i, n) => ({
    perfil_id: material.perfil_id,
    titulo: i.titulo.slice(0, 200),
    gancho: i.gancho.slice(0, 500),
    tese: i.tese.slice(0, 2000),
    cta: i.cta.slice(0, 300),
    formato: (FORMATOS as readonly string[]).includes(i.formato) ? i.formato : null,
    pilar: i.pilar.slice(0, 60) || null,
    coluna: "garagem",
    ordem: base + (n + 1) * 10,
    referencias: [],
  }));
  const { error } = await supabase.from("ideias").insert(linhas);
  if (error) return { erro: error.code === "42501" ? "Seu papel não permite criar ideias." : "Não foi possível enviar ao planejador." };
  await supabase.from("materiais_ia").update({ status: "publicado" }).eq("id", materialId);
  revalidatePath("/planejador");
  revalidatePath("/estudio");
  return { ok: `${linhas.length} ideia(s) enviada(s) para a coluna Ideias do planejador.` };
}

// Grava o roteiro gerado dentro da ideia de origem.
export async function salvarRoteiroNaIdeia(materialId: number): Promise<Resultado> {
  const { supabase, material } = await carregarMaterial(materialId);
  if (!material || material.tipo !== "roteiro" || !material.ideia_id) return { erro: "Roteiro sem ideia de origem." };
  const { data, error } = await supabase.from("ideias").update({ roteiro: material.saida }).eq("id", material.ideia_id).select("id");
  if (error || !data?.length) return { erro: "Não foi possível salvar. A ideia pode ter sido excluída ou seu papel não permite." };
  await supabase.from("materiais_ia").update({ status: "publicado" }).eq("id", materialId);
  revalidatePath("/planejador");
  revalidatePath("/estudio");
  return { ok: "Roteiro salvo na ideia." };
}

export async function aprovarMaterial(materialId: number): Promise<Resultado> {
  const supabase = await createClient();
  const { data } = await supabase.from("materiais_ia").update({ status: "publicado" }).eq("id", materialId).select("id");
  if (!data?.length) return { erro: "Não foi possível marcar como aprovado." };
  revalidatePath("/estudio");
  return { ok: "Marcado como aprovado." };
}
