// Relatórios: leitura do jsonb gravado no banco (formato 1, antigo de segunda; formato 2, de sexta e por período)
// e cálculos derivados.
// Funções puras, sem rede.

export type PerfilRel = {
  id: number;
  handle: string;
  nome: string | null;
  grupo: string;
  seguidores_inicio: number | null;
  seguidores_fim: number | null;
  dias_coletados: number;
  posts: number;
  interacoes: number;
};
export type PostRel = {
  id: string;
  handle: string;
  produto: string | null;
  tipo: string | null;
  legenda: string | null;
  permalink: string | null;
  thumb_path: string | null;
  publicado_em: string | null;
  likes: number | null;
  comentarios: number | null;
  interacoes: number;
};
export type MetaRel = { id: number; handle: string; metrica: string; alvo: number; prazo: string; base: number | null; atual: number | null };
export type IdeiaRel = { id: number; titulo: string; handle: string; interacoes: number | null; permalink: string | null };
export type DadosRelatorio = {
  perfis: PerfilRel[];
  top_posts: PostRel[];
  metas: MetaRel[];
  ideias_publicadas: IdeiaRel[];
  alertas: Record<string, number>;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const txt = (v: unknown): string | null => (typeof v === "string" ? v : null);
const lista = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];

// Converte o jsonb do banco em tipos seguros. Campos faltando viram null/0 em vez de quebrar a tela.
export function lerRelatorio(dados: unknown): DadosRelatorio {
  const d = dados && typeof dados === "object" && !Array.isArray(dados) ? (dados as Record<string, unknown>) : {};
  const alertas: Record<string, number> = {};
  if (d.alertas && typeof d.alertas === "object" && !Array.isArray(d.alertas)) {
    for (const [k, v] of Object.entries(d.alertas)) {
      const n = num(v);
      if (n !== null) alertas[k] = n;
    }
  }
  return {
    perfis: lista(d.perfis)
      .filter((p) => num(p.id) !== null && txt(p.handle))
      .map((p) => ({
        id: num(p.id)!,
        handle: txt(p.handle)!,
        nome: txt(p.nome),
        grupo: txt(p.grupo) ?? "proprio",
        seguidores_inicio: num(p.seguidores_inicio),
        seguidores_fim: num(p.seguidores_fim),
        dias_coletados: num(p.dias_coletados) ?? 0,
        posts: num(p.posts) ?? 0,
        interacoes: num(p.interacoes) ?? 0,
      })),
    top_posts: lista(d.top_posts)
      .filter((p) => txt(p.id) && txt(p.handle))
      .map((p) => ({
        id: txt(p.id)!,
        handle: txt(p.handle)!,
        produto: txt(p.produto),
        tipo: txt(p.tipo),
        legenda: txt(p.legenda),
        permalink: txt(p.permalink),
        thumb_path: txt(p.thumb_path),
        publicado_em: txt(p.publicado_em),
        likes: num(p.likes),
        comentarios: num(p.comentarios),
        interacoes: num(p.interacoes) ?? 0,
      })),
    metas: lista(d.metas)
      .filter((m) => num(m.id) !== null && num(m.alvo) !== null && txt(m.prazo))
      .map((m) => ({
        id: num(m.id)!,
        handle: txt(m.handle) ?? "",
        metrica: txt(m.metrica) ?? "",
        alvo: num(m.alvo)!,
        prazo: txt(m.prazo)!,
        base: num(m.base),
        atual: num(m.atual),
      })),
    ideias_publicadas: lista(d.ideias_publicadas)
      .filter((i) => num(i.id) !== null)
      .map((i) => ({ id: num(i.id)!, titulo: txt(i.titulo) ?? "", handle: txt(i.handle) ?? "", interacoes: num(i.interacoes), permalink: txt(i.permalink) })),
    alertas,
  };
}

export type LinhaPerfil = PerfilRel & {
  ganho: number | null;
  crescimentoPct: number | null;
  shareCrescimento: number | null; // 0 a 1, entre os perfis do relatório
  mediaInteracoes: number | null;
  coberturaIncompleta: boolean;
};

// diasPeriodo: dias do relatório (7 no semanal); menos leituras que isso marca a cobertura como incompleta.
export function linhasPerfis(perfis: PerfilRel[], diasPeriodo = 7): LinhaPerfil[] {
  const ganhos = perfis.map((p) => (p.seguidores_inicio !== null && p.seguidores_fim !== null ? p.seguidores_fim - p.seguidores_inicio : null));
  const somaPositivos = ganhos.reduce<number>((s, g) => s + Math.max(0, g ?? 0), 0);
  return perfis.map((p, i) => {
    const ganho = ganhos[i];
    return {
      ...p,
      ganho,
      crescimentoPct: ganho !== null && p.seguidores_inicio ? (ganho / p.seguidores_inicio) * 100 : null,
      shareCrescimento: ganho === null || somaPositivos <= 0 ? null : Math.max(0, ganho) / somaPositivos,
      mediaInteracoes: p.posts > 0 ? p.interacoes / p.posts : null,
      coberturaIncompleta: p.dias_coletados < diasPeriodo,
    };
  });
}

export type Totais = { seguidores: number; ganho: number | null; posts: number; interacoes: number };

export function totais(linhas: LinhaPerfil[]): Totais {
  const comGanho = linhas.filter((l) => l.ganho !== null);
  return {
    seguidores: linhas.reduce((s, l) => s + (l.seguidores_fim ?? 0), 0),
    ganho: comGanho.length ? comGanho.reduce((s, l) => s + (l.ganho as number), 0) : null,
    posts: linhas.reduce((s, l) => s + l.posts, 0),
    interacoes: linhas.reduce((s, l) => s + l.interacoes, 0),
  };
}

// Diferença em relação à semana anterior (null quando não há base).
export function diferenca(atual: number | null, anterior: number | null | undefined): number | null {
  return atual === null || anterior === null || anterior === undefined ? null : atual - anterior;
}

// Progresso de uma meta crescente, de 0 a 100.
export function progressoMeta(m: MetaRel): number | null {
  if (m.atual === null) return null;
  const base = m.base ?? 0;
  if (m.atual >= m.alvo) return 100;
  if (m.alvo <= base) return 0;
  return Math.max(0, Math.min(100, ((m.atual - base) / (m.alvo - base)) * 100));
}

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const sinal = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${inteiro.format(Math.abs(n))}`;

// Frases curtas para o topo do relatório. Só afirma o que os números sustentam.
export function destaques(linhas: LinhaPerfil[], top: PostRel[]): string[] {
  const frases: string[] = [];
  const crescendo = linhas.filter((l) => l.ganho !== null).sort((a, b) => (b.ganho as number) - (a.ganho as number));
  if (crescendo.length && (crescendo[0].ganho as number) > 0) {
    const l = crescendo[0];
    frases.push(`@${l.handle} foi quem mais ganhou seguidores: ${sinal(l.ganho as number)}.`);
  }
  const perdendo = crescendo.filter((l) => (l.ganho as number) < 0);
  if (perdendo.length) frases.push(`${perdendo.map((l) => `@${l.handle}`).join(", ")} ${perdendo.length > 1 ? "perderam" : "perdeu"} seguidores no período.`);
  const parados = linhas.filter((l) => l.posts === 0);
  if (parados.length) frases.push(`${parados.map((l) => `@${l.handle}`).join(", ")} não ${parados.length > 1 ? "publicaram" : "publicou"} nada.`);
  if (top[0] && top[0].interacoes > 0) frases.push(`Melhor post: @${top[0].handle}, com ${inteiro.format(top[0].interacoes)} interações.`);
  return frases;
}

// ─── Datas ───
const DIA_MS = 86_400_000;

// Segunda-feira da semana de uma data (AAAA-MM-DD).
export function segundaDaSemana(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(d.getTime() - dow * DIA_MS).toISOString().slice(0, 10);
}

export function rotuloSemana(inicio: string, fim: string): string {
  const f = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);
  return `${f(inicio)} a ${f(fim)}`;
}

export function isDataIso(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
