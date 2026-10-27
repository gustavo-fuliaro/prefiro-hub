// Perfis próprios do ambiente e o perfil escolhido (lidos no servidor, respeitando o RLS).
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_PERFIL, lerEscolha, type PerfilProprio } from "@/lib/perfis-proprios";

export async function perfisProprios(): Promise<PerfilProprio[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis")
    .select("id, handle, nome, foto_path")
    .eq("grupo", "proprio")
    .eq("ativo", true)
    .order("handle")
    .returns<PerfilProprio[]>();
  return data ?? [];
}

export async function escolhaDePerfil(): Promise<{ perfis: PerfilProprio[]; perfilAtual: number | null }> {
  const [perfis, jar] = await Promise.all([perfisProprios(), cookies()]);
  return { perfis, perfilAtual: lerEscolha(jar.get(COOKIE_PERFIL)?.value, perfis) };
}
