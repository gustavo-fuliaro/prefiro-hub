"use server";

import { revalidatePath } from "next/cache";
import { limparPosicionamento } from "@/lib/estudio";
import { createClient } from "@/lib/supabase/server";

export async function salvarPosicionamento(perfilId: number, entrada: { respostas: unknown; pilares: unknown }) {
  if (!Number.isInteger(perfilId)) return { erro: "Perfil inválido." };
  const dados = limparPosicionamento(entrada);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posicionamento")
    .upsert({ perfil_id: perfilId, ...dados }, { onConflict: "perfil_id" })
    .select("perfil_id");
  if (error || !data?.length) {
    return { erro: error?.code === "42501" || !data?.length ? "Seu papel não permite editar o posicionamento." : "Não foi possível salvar." };
  }
  revalidatePath("/estrategia");
  return { ok: "Posicionamento salvo." };
}
