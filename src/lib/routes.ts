// Rotas que não exigem login. /f/... é o formulário público (iscas digitais).
const PUBLIC_PATHS = ["/login", "/f"];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

// Menu principal.
// soAdmin: aparece para admins do ambiente (e para a conta principal).
// emBreve: área bloqueada, com cadeado; abre só a tela explicativa.
export type ItemMenu = { href: string; label: string; soAdmin?: boolean; emBreve?: boolean };

export const NAV_ITEMS: ItemMenu[] = [
  { href: "/perfis", label: "Perfis" },
  { href: "/comparativo", label: "Comparativo" },
  { href: "/metas", label: "Metas" },
  { href: "/planejador", label: "Planejador" },
  { href: "/calendario", label: "Calendário" },
  { href: "/progresso", label: "Progresso" },
  { href: "/leads", label: "Leads" },
  { href: "/briefings", label: "Briefing", emBreve: true },
  { href: "/arsenal-de-stories", label: "Arsenal de Stories", emBreve: true },
  { href: "/iscas-digitais", label: "Iscas Digitais" },
  { href: "/usuarios", label: "Usuários", soAdmin: true },
];

export function itensDoMenu(admin: boolean): ItemMenu[] {
  return NAV_ITEMS.filter((i) => !i.soAdmin || admin);
}
