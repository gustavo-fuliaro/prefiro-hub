// Cálculos do comparativo entre perfis e das metas. Funções puras, sem rede.

export type Snapshot = { perfil_id: number; dia: string; seguidores: number | null; total_posts: number | null };

export type ResumoPerfil = {
  perfil_id: number;
  seguidoresInicio: number | null;
  seguidoresFim: number | null;
  ganho: number | null;
  crescimentoPct: number | null;
  postsNoPeriodo: number | null;
  interacoesMedias: number | null; // por post, últimos 12 posts
  engajamentoPct: number | null;
};

const lidos = (s: Snapshot[], campo: "seguidores" | "total_posts") =>
  s.filter((p) => p[campo] !== null).sort((a, b) => a.dia.localeCompare(b.dia));

// Resumo de um perfil dentro da janela (snapshots já filtrados pelo período).
export function resumir(perfilId: number, janela: Snapshot[], interacoesMedias: number | null): ResumoPerfil {
  const seg = lidos(janela, "seguidores");
  const pos = lidos(janela, "total_posts");
  const ini = seg[0]?.seguidores ?? null;
  const fim = seg.at(-1)?.seguidores ?? null;
  const ganho = ini !== null && fim !== null && seg.length > 1 ? fim - ini : null;
  const postsNoPeriodo = pos.length > 1 ? (pos.at(-1)!.total_posts as number) - (pos[0].total_posts as number) : null;
  return {
    perfil_id: perfilId,
    seguidoresInicio: ini,
    seguidoresFim: fim,
    ganho,
    crescimentoPct: ganho !== null && ini ? (ganho / ini) * 100 : null,
    postsNoPeriodo,
    interacoesMedias,
    engajamentoPct: interacoesMedias !== null && fim ? (interacoesMedias / fim) * 100 : null,
  };
}

export type Participacao = { audiencia: number | null; crescimento: number | null; engajamento: number | null; voz: number | null };

// Fatia de cada perfil no total do grupo. Negativos não entram no total de crescimento.
export function participacoes(resumos: ResumoPerfil[]): Map<number, Participacao> {
  const soma = (f: (r: ResumoPerfil) => number | null) =>
    resumos.reduce((s, r) => s + Math.max(0, f(r) ?? 0), 0);
  const tot = {
    audiencia: soma((r) => r.seguidoresFim),
    crescimento: soma((r) => r.ganho),
    engajamento: soma((r) => r.interacoesMedias),
    voz: soma((r) => r.postsNoPeriodo),
  };
  const fatia = (v: number | null, total: number) => (v === null || total <= 0 ? null : Math.max(0, v) / total);
  return new Map(
    resumos.map((r) => [
      r.perfil_id,
      {
        audiencia: fatia(r.seguidoresFim, tot.audiencia),
        crescimento: fatia(r.ganho, tot.crescimento),
        engajamento: fatia(r.interacoesMedias, tot.engajamento),
        voz: fatia(r.postsNoPeriodo, tot.voz),
      },
    ]),
  );
}

// Crescimento acumulado em % desde o primeiro dia da janela, para comparar perfis de tamanhos diferentes.
export function crescimentoAcumulado(janela: Snapshot[]): { dia: string; pct: number }[] {
  const seg = lidos(janela, "seguidores");
  const base = seg[0]?.seguidores;
  if (!base) return [];
  return seg.map((p) => ({ dia: p.dia, pct: (((p.seguidores as number) - base) / base) * 100 }));
}

// ─── Metas ───
export const METRICAS_META = {
  seguidores: { rotulo: "Seguidores", unidade: "" },
  engajamento: { rotulo: "Engajamento médio", unidade: "%" },
  posts_mes: { rotulo: "Posts no mês", unidade: "" },
} as const;
export type MetricaMeta = keyof typeof METRICAS_META;

export function isMetricaMeta(v: unknown): v is MetricaMeta {
  return typeof v === "string" && Object.hasOwn(METRICAS_META, v);
}

export type StatusMeta = "atingida" | "no_ritmo" | "atrasada" | "vencida" | "sem_dados";

export const ROTULO_STATUS: Record<StatusMeta, string> = {
  atingida: "Atingida",
  no_ritmo: "No ritmo",
  atrasada: "Fora do ritmo",
  vencida: "Prazo vencido",
  sem_dados: "Sem dados suficientes",
};

const DIA_MS = 86_400_000;
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DIA_MS);

// Progresso e projeção de uma meta crescente (alvo maior que a base).
// `ritmoDiario` é o ganho médio por dia recente; a previsão assume que ele se mantém.
export function avaliarMeta(m: {
  base: number | null;
  atual: number | null;
  alvo: number;
  hoje: string;
  prazo: string;
  ritmoDiario: number | null;
}): { progressoPct: number | null; status: StatusMeta; previsao: string | null; faltam: number | null } {
  if (m.atual === null) return { progressoPct: null, status: "sem_dados", previsao: null, faltam: null };
  const faltam = Math.max(0, m.alvo - m.atual);
  const base = m.base ?? 0;
  const progressoPct = m.alvo > base ? Math.max(0, Math.min(100, ((m.atual - base) / (m.alvo - base)) * 100)) : m.atual >= m.alvo ? 100 : 0;
  if (m.atual >= m.alvo) return { progressoPct: 100, status: "atingida", previsao: null, faltam: 0 };
  if (m.hoje > m.prazo) return { progressoPct, status: "vencida", previsao: null, faltam };
  if (m.ritmoDiario === null || m.ritmoDiario <= 0) return { progressoPct, status: m.ritmoDiario === null ? "sem_dados" : "atrasada", previsao: null, faltam };
  const diasNecessarios = Math.ceil(faltam / m.ritmoDiario);
  const previsao = new Date(Date.parse(`${m.hoje}T00:00:00Z`) + diasNecessarios * DIA_MS).toISOString().slice(0, 10);
  return { progressoPct, status: previsao <= m.prazo ? "no_ritmo" : "atrasada", previsao, faltam };
}

// Ganho médio diário entre o ponto mais antigo e o mais recente dentro de `janelaDias`.
export function ritmoDiario(serie: { dia: string; valor: number | null }[], hoje: string, janelaDias = 30): number | null {
  const corte = new Date(Date.parse(`${hoje}T00:00:00Z`) - janelaDias * DIA_MS).toISOString().slice(0, 10);
  const pts = serie.filter((p) => p.valor !== null && p.dia >= corte).sort((a, b) => a.dia.localeCompare(b.dia));
  if (pts.length < 2) return null;
  const d = dias(pts[0].dia, pts.at(-1)!.dia);
  return d > 0 ? ((pts.at(-1)!.valor as number) - (pts[0].valor as number)) / d : null;
}

export function lerFormMeta(fd: FormData, hoje: string): { erro: string } | { dados: { perfil_id: number; metrica: MetricaMeta; alvo: number; prazo: string } } {
  const perfil_id = Number(fd.get("perfil_id"));
  if (!Number.isInteger(perfil_id) || perfil_id <= 0) return { erro: "Escolha o perfil." };
  const metrica = fd.get("metrica");
  if (!isMetricaMeta(metrica)) return { erro: "Escolha a métrica." };
  const alvo = Number(String(fd.get("alvo") ?? "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(alvo) || alvo <= 0) return { erro: "Informe um alvo maior que zero." };
  if (metrica === "engajamento" && alvo > 100) return { erro: "Engajamento é uma porcentagem (até 100)." };
  const prazo = String(fd.get("prazo") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo) || Number.isNaN(Date.parse(prazo))) return { erro: "Informe o prazo." };
  if (prazo <= hoje) return { erro: "O prazo precisa ser uma data futura." };
  return { dados: { perfil_id, metrica, alvo, prazo } };
}
