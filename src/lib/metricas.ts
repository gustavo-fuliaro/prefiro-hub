// Cálculos do cockpit. Funções puras, sem rede.

export type Ponto = { dia: string; seguidores: number | null; total_posts: number | null };
export type Farol = "verde" | "amarelo" | "vermelho";
export type Periodo = "30" | "60" | "90" | "tudo";

export const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: "30", rotulo: "30 dias" },
  { valor: "60", rotulo: "60 dias" },
  { valor: "90", rotulo: "90 dias" },
  { valor: "tudo", rotulo: "Desde o início" },
];

export function lerPeriodo(v: unknown): Periodo {
  return v === "60" || v === "90" || v === "tudo" ? v : "30";
}

// Farol pela variação % na janela: acima de +limiar verde, abaixo de -limiar vermelho.
// Sem base (null) fica amarelo, que é neutro.
export function farol(pct: number | null, limiar = 2): Farol {
  if (pct === null || Number.isNaN(pct)) return "amarelo";
  if (pct > limiar) return "verde";
  if (pct < -limiar) return "vermelho";
  return "amarelo";
}

// Mantém os pontos dentro dos últimos N dias contados a partir de "hoje" (AAAA-MM-DD).
export function filtrarPeriodo<T extends { dia: string }>(serie: T[], periodo: Periodo, hoje: string): T[] {
  if (periodo === "tudo") return [...serie];
  const corte = new Date(`${hoje}T00:00:00Z`);
  corte.setUTCDate(corte.getUTCDate() - Number(periodo));
  const limite = corte.toISOString().slice(0, 10);
  return serie.filter((p) => p.dia >= limite);
}

// Variação entre o primeiro e o último ponto com leitura. Dias sem leitura (null) são ignorados,
// para não desenhar quedas falsas quando a Meta não respondeu.
export function variacao<T>(serie: T[], ler: (p: T) => number | null) {
  const lidos = serie.map(ler).filter((v): v is number => v !== null);
  if (lidos.length === 0) return { base: null, atual: null, abs: null, pct: null, pontos: 0 };
  const base = lidos[0];
  const atual = lidos[lidos.length - 1];
  return {
    base,
    atual,
    abs: atual - base,
    pct: base !== 0 ? ((atual - base) / base) * 100 : null,
    pontos: lidos.length,
  };
}

// Posts publicados por dia na janela, a partir do contador total de posts do perfil.
export function postsPorDia(serie: Ponto[]): number | null {
  const lidos = serie.filter((p) => p.total_posts !== null);
  if (lidos.length < 2) return null;
  const a = lidos[0], b = lidos[lidos.length - 1];
  const dias = (Date.parse(b.dia) - Date.parse(a.dia)) / 86_400_000;
  if (dias <= 0) return null;
  return ((b.total_posts as number) - (a.total_posts as number)) / dias;
}

// Engajamento médio: interações médias por post ÷ seguidores, em %.
export function engajamento(posts: { likes: number | null; comentarios: number | null }[], seguidores: number | null): number | null {
  if (!seguidores || posts.length === 0) return null;
  const media = posts.reduce((s, p) => s + (p.likes ?? 0) + (p.comentarios ?? 0), 0) / posts.length;
  return (media / seguidores) * 100;
}

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR");

export function formatarNumero(n: number | null | undefined, opts?: { compacto?: boolean }): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return opts?.compacto === false || Math.abs(n) < 10_000 ? inteiro.format(Math.round(n)) : compacto.format(n);
}

export function formatarVariacao(abs: number | null): string {
  if (abs === null) return "—";
  if (abs === 0) return "sem variação";
  return `${abs > 0 ? "+" : "−"}${formatarNumero(Math.abs(abs))}`;
}

export function formatarPct(pct: number | null, casas = 1): string {
  if (pct === null || Number.isNaN(pct)) return "—";
  return `${pct.toFixed(casas).replace(".", ",")}%`;
}

// Caminho SVG suave (Catmull-Rom → Bézier) para um gráfico pequeno de largura w e altura h.
export function caminhoSparkline(valores: number[], w: number, h: number, margem = 6) {
  if (valores.length === 0) return { linha: "", area: "", ultimo: null as null | { x: number; y: number } };
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const y = (v: number) => (max === min ? h / 2 : h - margem - ((v - min) / (max - min)) * (h - 2 * margem));
  let pts = valores.map((v, i) => ({ x: valores.length === 1 ? w : (i / (valores.length - 1)) * w, y: y(v) }));
  if (pts.length === 1) pts = [{ x: 0, y: pts[0].y }, pts[0]];
  const f = (n: number) => n.toFixed(1);
  let linha = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    linha += ` C${f(p1.x + (p2.x - p0.x) / 6)},${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)},${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)},${f(p2.y)}`;
  }
  const area = `${linha} L${f(w)},${f(h)} L0,${f(h)} Z`;
  return { linha, area, ultimo: pts[pts.length - 1] };
}
