"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function marcarLido(id: number, lido = true) {
  if (!Number.isInteger(id)) return;
  const supabase = await createClient();
  await supabase.from("alertas").update({ lido }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function marcarTodosLidos() {
  const supabase = await createClient();
  await supabase.from("alertas").update({ lido: true }).eq("lido", false);
  revalidatePath("/", "layout");
}
