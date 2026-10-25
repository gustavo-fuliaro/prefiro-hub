// Lê as variáveis públicas do Supabase e falha com uma mensagem clara se faltarem.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copie .env.example para .env.local e preencha.",
    );
  }
  return { url, key };
}

// Todas as tabelas do Hub ficam no schema "hub", separado das tabelas que já existem no projeto.
export const HUB_SCHEMA = "hub";
