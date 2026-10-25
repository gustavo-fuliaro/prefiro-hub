// Rotas que não exigem login.
const PUBLIC_PATHS = ["/login"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

// Menu principal. Itens com "fase" ainda não existem e aparecem desabilitados.
export const NAV_ITEMS: { href: string; label: string; fase?: number }[] = [
  { href: "/perfis", label: "Perfis" },
  { href: "/comparativo", label: "Comparativo" },
  { href: "/metas", label: "Metas" },
  { href: "/alertas", label: "Alertas" },
  { href: "/planejador", label: "Planejador" },
  { href: "/calendario", label: "Calendário" },
  { href: "/briefings", label: "Briefings" },
  { href: "/estrategia", label: "Estratégia" },
  { href: "/estudio", label: "Estúdio de IA" },
  { href: "/progresso", label: "Progresso" },
];
