export const GRUPOS = {
  proprio: "Próprio",
  time: "Time de vendas",
  parceiro: "Parceiro",
  concorrente: "Concorrente",
} as const;
export type Grupo = keyof typeof GRUPOS;

export const FONTES = {
  graph_api: "API oficial (conta própria)",
  business_discovery: "Business Discovery",
  windsor: "Windsor.ai",
  manual: "Manual",
} as const;
export type Fonte = keyof typeof FONTES;

export type Perfil = {
  id: number;
  handle: string;
  nome: string | null;
  grupo: Grupo;
  fonte: Fonte;
  ativo: boolean;
  criado_em: string;
};

// Aceita "@handle", "handle", "instagram.com/handle", URL completa com query ou barra final.
// Devolve o handle em minúsculas ou null se não for um nome de usuário válido do Instagram.
export function normalizarHandle(entrada: string): string | null {
  let s = (entrada ?? "").trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\//i, "").replace(/^(www\.)?instagram\.com\//i, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(s)) return null;
  if (s.startsWith(".") || s.endsWith(".") || s.includes("..")) return null;
  return s;
}

export function isGrupo(v: unknown): v is Grupo {
  return typeof v === "string" && Object.hasOwn(GRUPOS, v);
}

export function isFonte(v: unknown): v is Fonte {
  return typeof v === "string" && Object.hasOwn(FONTES, v);
}

// Fonte sugerida ao cadastrar: contas próprias usam a API oficial; as demais, Business Discovery.
export function fontePadrao(grupo: Grupo): Fonte {
  return grupo === "proprio" ? "graph_api" : "business_discovery";
}
