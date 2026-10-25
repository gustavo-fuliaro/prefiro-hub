import { createClient } from "@/lib/supabase/server";

// Cadeado do Estúdio de IA (hub.config). Na dúvida (chave ausente ou erro), fica bloqueado.
export async function estudioLiberado(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("config").select("valor").eq("chave", "estudio_liberado").maybeSingle<{ valor: unknown }>();
  return data?.valor === true;
}
