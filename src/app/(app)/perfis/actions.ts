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

// Exclui um perfil monitorado e todo o histórico ligado a ele (números, posts, metas, ideias e alertas).
// O RLS só deixa excluir perfis da própria conta, e só para admin ou estrategista.
export async function excluirPerfil(id: number): Promise<{ erro?: string; ok?: string }> {
  if (!Number.isInteger(id) || id <= 0) return { erro: "Perfil inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("perfis").delete().eq("id", id).select("handle");
  if (error) return { erro: "Não foi possível excluir o perfil. Tente de novo." };
  if (!data?.length) return { erro: "Perfil não encontrado ou seu papel não permite excluir." };
  revalidatePath("/", "layout");
  return { ok: `@${data[0].handle} foi excluído.` };
}
