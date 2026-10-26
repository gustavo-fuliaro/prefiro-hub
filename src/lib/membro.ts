import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Papel = "admin" | "estrategista" | "criador" | "leitura";
export type Membro = {
  user_id: string;
  nome: string;
  papel: Papel;
  conta_id: number;
  super_admin: boolean;
  ativo: boolean;
  deve_trocar_senha: boolean;
};

// Usuário logado + seu cadastro em hub.membros (null se ainda não foi liberado por um admin).
export async function membroAtual(): Promise<{ email: string; membro: Membro | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("membros")
    .select("user_id, nome, papel, conta_id, super_admin, ativo, deve_trocar_senha")
    .eq("user_id", user.id)
    .maybeSingle<Membro>();

  return { email: user.email ?? "", membro: data ?? null };
}

export function podeEditarCadastro(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "estrategista";
}

export function podeEditarConteudo(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "estrategista" || papel === "criador";
}
