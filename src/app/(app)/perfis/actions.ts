"use server";

import { revalidatePath } from "next/cache";
import { fontePadrao, isGrupo, normalizarHandle } from "@/lib/perfis";
import { createClient } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string; ok?: string };

export async function adicionarPerfil(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const handle = normalizarHandle(String(form.get("handle") ?? ""));
  if (!handle) return { erro: "Informe um @ do Instagram válido (letras, números, ponto e sublinhado)." };

  const grupo = form.get("grupo");
  if (!isGrupo(grupo)) return { erro: "Escolha o grupo do perfil." };

  const nome = String(form.get("nome") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("perfis").insert({ handle, nome, grupo, fonte: fontePadrao(grupo) });

  if (error) {
    if (error.code === "23505") return { erro: `@${handle} já está na lista.` };
    if (error.code === "42501") return { erro: "Seu papel não permite cadastrar perfis." };
    return { erro: "Não foi possível salvar. Tente de novo." };
  }

  revalidatePath("/perfis");
  return { ok: `@${handle} adicionado.` };
}
