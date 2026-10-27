// Navegação entre os perfis próprios: qual perfil está escolhido nas abas de produção
// (Planejador, Calendário, Progresso, Briefing, Arsenal de Stories, Iscas Digitais).
// Código puro, sem Supabase, testado com Vitest.

export type PerfilProprio = { id: number; handle: string; nome: string | null; foto_path: string | null };

// A escolha fica num cookie para valer em todas as abas e sobreviver ao recarregar.
export const COOKIE_PERFIL = "hub_perfil";
export const TODOS = "todos";

// null = visão em grupo (todos os perfis). Valor desconhecido, apagado ou de outro ambiente também vira grupo.
export function lerEscolha(valor: string | null | undefined, perfis: PerfilProprio[]): number | null {
  if (!valor || valor === TODOS) return null;
  const id = Number(valor);
  return Number.isInteger(id) && perfis.some((p) => p.id === id) ? id : null;
}

export function perfilPorId(perfis: PerfilProprio[], id: number | null | undefined): PerfilProprio | null {
  return id == null ? null : (perfis.find((p) => p.id === id) ?? null);
}

// Visão individual mostra só o perfil escolhido; visão em grupo mostra tudo (inclusive "sem perfil").
export function doPerfil<T extends { perfil_id: number | null }>(itens: T[], escolhido: number | null): T[] {
  return escolhido === null ? itens : itens.filter((t) => t.perfil_id === escolhido);
}

export function rotuloEscopo(perfis: PerfilProprio[], escolhido: number | null): string {
  const p = perfilPorId(perfis, escolhido);
  return p ? `@${p.handle}` : "Todos os perfis";
}

// Perfil sugerido ao criar algo: o escolhido; na visão em grupo, o único perfil próprio se só houver um.
export function perfilPadrao(perfis: PerfilProprio[], escolhido: number | null): number | null {
  if (escolhido !== null) return escolhido;
  return perfis.length === 1 ? perfis[0].id : null;
}

// Relatórios: null = do grupo; texto = @ do perfil.
export function relatorioDoEscopo(perfilHandle: string | null, perfis: PerfilProprio[], escolhido: number | null): boolean {
  const p = perfilPorId(perfis, escolhido);
  return p ? perfilHandle === p.handle : perfilHandle === null;
}
