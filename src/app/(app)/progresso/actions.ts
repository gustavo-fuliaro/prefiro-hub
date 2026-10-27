"use server";

import { revalidatePath } from "next/cache";
import { perfisProprios } from "@/lib/dados-perfis";
import { isDataIso } from "@/lib/relatorio";
import { createClient } from "@/lib/supabase/server";

// Escopo do relatório: "grupo" (todos os perfis juntos), "cada" (um relatório por perfil próprio)
// ou o id de um perfil próprio.
export type EscopoGerar = "grupo" | "cada" | number;

// Relatório por período escolhido. Fica guardado à parte e nunca substitui um relatório semanal.
export async function gerarRelatorioPeriodo(inicio: string, fim: string, escopo: EscopoGerar = "grupo"): Promise<{ gerados?: { id: number; perfil: number | null }[]; erro?: string }> {
  if (!isDataIso(inicio) || !isDataIso(fim)) return { erro: "Escolha as duas datas." };
  if (fim < inicio) return { erro: "A data final precisa ser igual ou depois da inicial." };

  let alvos: (number | null)[];
  if (escopo === "grupo") alvos = [null];
  else if (escopo === "cada") {
    alvos = (await perfisProprios()).map((p) => p.id);
    if (alvos.length === 0) return { erro: "Nenhum perfil próprio cadastrado." };
  } else if (Number.isInteger(escopo)) alvos = [escopo];
  else return { erro: "Escolha de quais perfis é o relatório." };

  const supabase = await createClient();
  const gerados: { id: number; perfil: number | null }[] = [];
  for (const perfil of alvos) {
    const { data, error } = await supabase.rpc("gerar_relatorio_periodo", { p_inicio: inicio, p_fim: fim, p_perfil: perfil });
    if (error) {
      if (gerados.length) revalidatePath("/progresso");
      if (error.code === "42501") return { erro: "Seu papel não permite gerar relatórios." };
      if (error.code === "22023") return { erro: error.message };
      return { erro: gerados.length ? `Gerados ${gerados.length} de ${alvos.length}. Não foi possível gerar o restante.` : "Não foi possível gerar o relatório." };
    }
    gerados.push({ id: data as number, perfil });
  }
  revalidatePath("/progresso");
  return { gerados };
}
