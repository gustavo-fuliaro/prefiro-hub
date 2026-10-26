"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// O RLS garante que só os alertas da conta de quem está logado são alterados.
export async function marcarLida(id: number, lido = true): Promise<void> {
  if (!Number.isInteger(id)) return;
  const supabase = await createClient();
  await supabase.from("alertas").update({ lido }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function marcarTodasLidas(): Promise<void> {
  const supabase = await createClient();
  await supabase.from("alertas").update({ lido: true }).eq("lido", false);
  revalidatePath("/", "layout");
}
