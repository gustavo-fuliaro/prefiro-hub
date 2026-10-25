import { createBrowserClient } from "@supabase/ssr";
import { HUB_SCHEMA, supabaseEnv } from "@/lib/env";

export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key, { db: { schema: HUB_SCHEMA } });
}
