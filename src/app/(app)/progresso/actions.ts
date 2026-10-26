"use server";

import { revalidatePath } from "next/cache";
import { isDataIso } from "@/lib/relatorio";
import { createClient } from "@/lib/supabase/server";

// Relatório por período escolhido. Fica guardado à parte e nunca substitui um relatório semanal.
export async function gerarRelatorioPeriodo(inicio: string, fim: string): Promise<{ id?: number; erro?: string }> {
  if (!isDataIso(inicio) || !isDataIso(fim)) return { erro: "Escolha as duas datas." };
  if (fim < inicio) return { erro: "A data final precisa ser igual ou depois da inicial." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gerar_relatorio_periodo", { p_inicio: inicio, p_fim: fim });
  if (error) {
    if (error.code === "42501") return { erro: "Seu papel não permite gerar relatórios." };
    if (error.code === "22023") return { erro: error.message };
    return { erro: "Não foi possível gerar o relatório." };
  }
  revalidatePath("/progresso");
  return { id: data as number };
}
