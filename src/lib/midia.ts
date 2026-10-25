import { supabaseEnv } from "@/lib/env";

// URL pública de um arquivo no bucket de imagens do Hub.
export function urlMidia(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  const { url } = supabaseEnv();
  return `${url}/storage/v1/object/public/hub-midia/${caminho.split("/").map(encodeURIComponent).join("/")}`;
}
