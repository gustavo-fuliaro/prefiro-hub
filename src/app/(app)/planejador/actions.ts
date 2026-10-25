"use server";

import { revalidatePath } from "next/cache";
import { isColuna, lerFormIdeia, limparChecklist, type Coluna } from "@/lib/planejador";
import { createClient } from "@/lib/supabase/server";

export type Resultado = { erro?: string; ok?: string; id?: number };

function revalidar() {
  revalidatePath("/planejador");
  revalidatePath("/calendario");
  revalidatePath("/briefings");
}

// UPDATE/DELETE barrados pelo RLS não dão erro: só não alteram linha nenhuma.
const SEM_ALTERACAO = "Nada foi alterado. A ideia pode ter sido excluída ou seu papel não permite editar.";

function mensagem(error: { code?: string } | null): string {
  if (error?.code === "42501") return "Seu papel não permite editar o planejamento.";
  return "Não foi possível salvar. Tente de novo.";
}

export async function salvarIdeia(fd: FormData): Promise<Resultado> {
  const lido = lerFormIdeia(fd);
  if ("erro" in lido) return { erro: lido.erro };
  const supabase = await createClient();
  const id = Number(fd.get("id")) || null;

  if (id) {
    const { data, error } = await supabase.from("ideias").update(lido.dados).eq("id", id).select("id");
    if (error) return { erro: mensagem(error) };
    if (!data?.length) return { erro: SEM_ALTERACAO };
    revalidar();
    return { ok: "Ideia salva.", id };
  }

  // Nova ideia entra no fim da coluna.
  const { data: ultima } = await supabase
    .from("ideias")
    .select("ordem")
    .eq("perfil_id", lido.dados.perfil_id)
    .eq("coluna", lido.dados.coluna)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle<{ ordem: number }>();
  const { data, error } = await supabase
    .from("ideias")
    .insert({ ...lido.dados, ordem: (ultima?.ordem ?? 0) + 10 })
    .select("id")
    .single<{ id: number }>();
  if (error) return { erro: mensagem(error) };
  revalidar();
  return { ok: "Ideia criada.", id: data.id };
}

// Move uma ideia para `coluna` e grava a nova ordem dessa coluna.
export async function moverIdeia(id: number, coluna: Coluna, idsOrdenados: number[]): Promise<Resultado> {
  if (!Number.isInteger(id) || !isColuna(coluna)) return { erro: "Movimento inválido." };
  const ids = idsOrdenados.filter((x) => Number.isInteger(x)).slice(0, 500);
  const supabase = await createClient();
  const { data: movida, error } = await supabase.from("ideias").update({ coluna }).eq("id", id).select("id");
  if (error) return { erro: mensagem(error) };
  if (!movida?.length) return { erro: SEM_ALTERACAO };
  const resultados = await Promise.all(
    ids.map((x, i) => supabase.from("ideias").update({ ordem: (i + 1) * 10 }).eq("id", x).eq("coluna", coluna)),
  );
  const falha = resultados.find((r) => r.error);
  if (falha) return { erro: mensagem(falha.error) };
  revalidar();
  return { ok: "Movida." };
}

export async function excluirIdeia(id: number): Promise<Resultado> {
  if (!Number.isInteger(id)) return { erro: "Ideia inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ideias").delete().eq("id", id).select("id");
  if (error) return { erro: mensagem(error) };
  if (!data?.length) return { erro: SEM_ALTERACAO };
  revalidar();
  return { ok: "Ideia excluída." };
}

export async function salvarBriefing(ideiaId: number, checklist: unknown, observacoes: string): Promise<Resultado> {
  if (!Number.isInteger(ideiaId)) return { erro: "Ideia inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("briefings").upsert(
    { ideia_id: ideiaId, checklist: limparChecklist(checklist), observacoes: observacoes.trim().slice(0, 2000) || null },
    { onConflict: "ideia_id" },
  );
  if (error) return { erro: mensagem(error) };
  revalidatePath("/briefings");
  return { ok: "Briefing salvo." };
}
