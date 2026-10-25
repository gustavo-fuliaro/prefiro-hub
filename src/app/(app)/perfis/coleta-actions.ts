"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoColeta = { erro?: string; ok?: string };

// Dispara a Edge Function de coleta com a sessão do usuário (só admin e estrategista passam).
export async function coletarAgora(_prev: EstadoColeta, form: FormData): Promise<EstadoColeta> {
  const perfilId = Number(form.get("perfil_id")) || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ perfis_ok: number; perfis_erro: number; erro?: string }>(
    "coletar-perfis",
    { body: perfilId ? { perfil_id: perfilId } : {} },
  );

  if (error) {
    let msg = "Não foi possível coletar agora.";
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.erro) msg = corpo.erro;
    } catch {}
    return { erro: msg };
  }

  revalidatePath("/perfis", "layout");
  if (!data) return { erro: "A coleta não respondeu." };
  return data.perfis_erro
    ? { ok: `Coleta feita: ${data.perfis_ok} ok, ${data.perfis_erro} com erro (veja a coluna Situação).` }
    : { ok: `Coleta feita: ${data.perfis_ok} perfil(is) atualizado(s).` };
}
