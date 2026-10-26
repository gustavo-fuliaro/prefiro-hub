"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Chamado depois que o Supabase Auth aceitou a nova senha: libera o uso do Hub.
export async function confirmarTroca(): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirmar_troca_senha");
  if (error) return { erro: "A senha foi trocada, mas não conseguimos liberar o acesso. Recarregue a página." };
  redirect("/perfis");
}
