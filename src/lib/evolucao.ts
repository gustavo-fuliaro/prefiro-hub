// Indicadores de "Evolução no tempo" e "Desempenho dos últimos posts" do cockpit de um perfil.
// Funções puras, sem rede. Toda série vem de leituras reais; sem leitura, o valor é null (nunca zero inventado).
import { filtrarPeriodo, postsPorDia, variacao, type Periodo, type Ponto } from "@/lib/metricas";

export type Leitura = { post_id: string; dia: string; likes: number | null; comentarios: number | null; views: number | null };
export type PostBase = { id: string; publicado_em: string | null; produto: string | null; tipo: string | null; legenda: string | null; permalink: string | null };

// Soma diária das métricas dos posts lidos naquele dia (a coleta lê os 25 posts mais recentes).
export type Dia = { dia: string; likes: number | null; comentarios: number | null; views: number | null; posts: number; interacoesMedia: number | null };

export function somaPorDia(leituras: Leitura[]): Dia[] {
  const mapa = new Map<string, { likes: number; temLikes: boolean; com: number; temCom: boolean; views: number; temViews: boolean; n: number }>();
  for (const l of leituras) {
    const d = mapa.get(l.dia) ?? { likes: 0, temLikes: false, com: 0, temCom: false, views: 0, temViews: false, n: 0 };
    if (l.likes !== null) { d.likes += l.likes; d.temLikes = true; }
    if (l.comentarios !== null) { d.com += l.comentarios; d.temCom = true; }
    if (l.views !== null) { d.views += l.views; d.temViews = true; }
    d.n += 1;
    mapa.set(l.dia, d);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, d]) => ({
      dia,
      likes: d.temLikes ? d.likes : null,
      comentarios: d.temCom ? d.com : null,
      views: d.temViews ? d.views : null,
      posts: d.n,
      interacoesMedia: d.temLikes || d.temCom ? (d.likes + d.com) / d.n : null,
    }));
}

export type Indicador = {
  chave: "seguidores" | "views" | "likes" | "comentarios" | "posts_dia" | "engajamento";
  titulo: string;
  principal?: boolean;
  /** Variação absoluta na janela (null se houver menos de 2 leituras). */
  delta: number | null;
  /** Variação percentual (para engajamento, a variação é em pontos percentuais e pct fica null). */
  pct: number | null;
  inicio: number | null;
  fim: number | null;
  serie: number[];
  leituras: number;
  nota: string;
};

// Monta os seis indicadores da referência para a janela escolhida.
export function indicadores(opts: { snapshots: Ponto[]; leituras: Leitura[]; periodo: Periodo; hoje: string }): Indicador[] {
  const snaps = filtrarPeriodo(opts.snapshots, opts.periodo, opts.hoje);
  const dias = filtrarPeriodo(somaPorDia(opts.leituras), opts.periodo, opts.hoje);
  const segPorDia = new Map(opts.snapshots.map((s) => [s.dia, s.seguidores]));

  const ind = (
    chave: Indicador["chave"], titulo: string, serie: { v: number | null }[], nota: string, principal = false,
  ): Indicador => {
    const v = variacao(serie, (p) => p.v);
    return {
      chave, titulo, principal, nota,
      delta: v.pontos >= 2 ? v.abs : null,
      pct: v.pontos >= 2 ? v.pct : null,
      inicio: v.base, fim: v.atual, leituras: v.pontos,
      serie: serie.map((p) => p.v).filter((x): x is number => x !== null),
    };
  };

  const posts = snaps.filter((s) => s.total_posts !== null);
  const ppd = postsPorDia(snaps);
  const engSerie = dias.map((d) => {
    const seg = segPorDia.get(d.dia);
    return { v: d.interacoesMedia !== null && seg ? (d.interacoesMedia / seg) * 100 : null };
  });
  const eng = ind("engajamento", "Engajamento médio", engSerie, "Interações médias por post ÷ seguidores, por dia.");

  return [
    ind("seguidores", "Seguidores", snaps.map((s) => ({ v: s.seguidores })), "Seguidores no primeiro e no último dia do período.", true),
    ind("views", "Views dos posts", dias.map((d) => ({ v: d.views })), "Soma das views dos Reels entre os 25 posts mais recentes."),
    ind("likes", "Curtidas dos posts", dias.map((d) => ({ v: d.likes })), "Soma das curtidas dos 25 posts mais recentes."),
    ind("comentarios", "Comentários dos posts", dias.map((d) => ({ v: d.comentarios })), "Soma dos comentários dos 25 posts mais recentes."),
    {
      chave: "posts_dia", titulo: "Posts por dia", nota: "Posts novos por dia, pelo total de posts do perfil.",
      delta: ppd, pct: null,
      inicio: posts[0]?.total_posts ?? null, fim: posts.at(-1)?.total_posts ?? null,
      serie: posts.map((s) => s.total_posts as number), leituras: posts.length,
    },
    // Engajamento varia em pontos percentuais: a variação relativa de uma taxa confunde mais do que ajuda.
    { ...eng, pct: null },
  ];
}

export type BarraPost = { id: string; dia: string | null; rotulo: string; legenda: string | null; permalink: string | null; formato: string; likes: number | null; comentarios: number | null; views: number | null };

const FORMATO: Record<string, string> = { VIDEO: "Reel", CAROUSEL_ALBUM: "Carrossel", IMAGE: "Foto" };

// Os N posts mais recentes, do mais antigo ao mais novo, com a última leitura de cada um.
export function ultimosPosts(posts: PostBase[], leituras: Leitura[], n = 8): BarraPost[] {
  const ultima = new Map<string, Leitura>();
  for (const l of [...leituras].sort((a, b) => a.dia.localeCompare(b.dia))) ultima.set(l.post_id, l);
  return [...posts]
    .filter((p) => p.publicado_em)
    .sort((a, b) => (b.publicado_em ?? "").localeCompare(a.publicado_em ?? ""))
    .slice(0, n)
    .reverse()
    .map((p) => {
      const m = ultima.get(p.id);
      const dia = p.publicado_em ? p.publicado_em.slice(0, 10) : null;
      return {
        id: p.id, dia,
        rotulo: dia ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : "—",
        legenda: p.legenda, permalink: p.permalink,
        formato: p.produto === "REELS" ? "Reel" : FORMATO[p.tipo ?? ""] ?? "Post",
        likes: m?.likes ?? null, comentarios: m?.comentarios ?? null, views: m?.views ?? null,
      };
    });
}
