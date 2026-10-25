"use server";

import { revalidatePath } from "next/cache";
import { isDataIso } from "@/lib/relatorio";
import { createClient } from "@/lib/supabase/server";

// Gera ou atualiza o relatório da semana que começa em `inicio` (segunda-feira).
export async function gerarRelatorio(inicio: string): Promise<{ erro?: string }> {
  if (!isDataIso(inicio)) return { erro: "Semana inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("gerar_relatorio_semanal", { p_inicio: inicio });
  if (error) {
    return { erro: error.code === "42501" ? "Só admin ou estrategista pode gerar o relatório." : error.code === "22023" ? "Essa semana ainda não começou." : "Não foi possível gerar o relatório." };
  }
  revalidatePath("/progresso");
  return {};
}
