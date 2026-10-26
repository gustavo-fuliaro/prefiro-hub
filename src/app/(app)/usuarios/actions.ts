"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UsuarioLista } from "@/lib/usuarios";

export type RespostaUsuarios = { ok?: string; erro?: string; senha_provisoria?: string; email?: string; usuarios?: UsuarioLista[] };

// Toda ação passa pela Edge Function admin-usuarios, que confere se quem chama é a conta administradora
// principal e usa a chave de serviço só no servidor do Supabase.
export async function chamarGestao(corpo: Record<string, unknown>): Promise<RespostaUsuarios> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<RespostaUsuarios>("admin-usuarios", { body: corpo });
  if (error) {
    let msg = "Não foi possível concluir a ação.";
    try {
      const c = await (error as { context?: Response }).context?.json();
      if (c?.erro) msg = c.erro;
    } catch {}
    return { erro: msg };
  }
  if (corpo.acao !== "listar") revalidatePath("/usuarios");
  return data ?? { erro: "Sem resposta da gestão de usuários." };
}
