// Rotas que não exigem login.
const PUBLIC_PATHS = ["/login"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

// Menu principal. "soAdmin" aparece só para a conta administradora principal.
export type ItemMenu = { href: string; label: string; soAdmin?: boolean };

export const NAV_ITEMS: ItemMenu[] = [
  { href: "/perfis", label: "Perfis" },
  { href: "/comparativo", label: "Comparativo" },
  { href: "/metas", label: "Metas" },
  { href: "/planejador", label: "Planejador" },
  { href: "/calendario", label: "Calendário" },
  { href: "/briefings", label: "Briefings" },
  { href: "/progresso", label: "Progresso" },
  { href: "/usuarios", label: "Usuários", soAdmin: true },
];

export function itensDoMenu(superAdmin: boolean): ItemMenu[] {
  return NAV_ITEMS.filter((i) => !i.soAdmin || superAdmin);
}
