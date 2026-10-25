import type { Ideia } from "@/lib/planejador";
import type { Grupo } from "@/lib/perfis";
import { createClient } from "@/lib/supabase/server";

export type PerfilCurto = { id: number; handle: string; nome: string | null; grupo: Grupo };
export type PostCurto = { id: string; legenda: string | null; publicado_em: string | null; permalink: string | null };

export const CAMPOS_IDEIA =
  "id, perfil_id, titulo, gancho, tese, cta, formato, pilar, ambiente, coluna, status_producao, ordem, publicar_em, referencias, post_id";

export async function listarPerfisAtivos(): Promise<PerfilCurto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis")
    .select("id, handle, nome, grupo")
    .eq("ativo", true)
    .order("grupo")
    .order("handle")
    .returns<PerfilCurto[]>();
  // Perfis próprios primeiro: são os que a equipe planeja.
  return (data ?? []).sort((a, b) => Number(b.grupo === "proprio") - Number(a.grupo === "proprio"));
}

export function escolherPerfil(perfis: PerfilCurto[], handle: unknown): PerfilCurto | null {
  return perfis.find((p) => p.handle === handle) ?? perfis[0] ?? null;
}

export async function listarIdeias(perfilId?: number): Promise<Ideia[]> {
  const supabase = await createClient();
  let q = supabase.from("ideias").select(CAMPOS_IDEIA).order("ordem");
  if (perfilId) q = q.eq("perfil_id", perfilId);
  const { data } = await q.returns<Ideia[]>();
  return data ?? [];
}

export async function listarPostsRecentes(perfilId: number): Promise<PostCurto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, legenda, publicado_em, permalink")
    .eq("perfil_id", perfilId)
    .order("publicado_em", { ascending: false })
    .limit(30)
    .returns<PostCurto[]>();
  return data ?? [];
}
