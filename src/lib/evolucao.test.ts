import { describe, expect, it } from "vitest";
import { indicadores, somaPorDia, ultimosPosts, type Leitura, type PostBase } from "./evolucao";

const L = (post_id: string, dia: string, likes: number | null, comentarios: number | null, views: number | null = null): Leitura => ({ post_id, dia, likes, comentarios, views });

describe("somaPorDia", () => {
  it("soma por dia e deixa null quando nenhuma leitura do dia tem o dado", () => {
    const r = somaPorDia([L("a", "2026-10-25", 10, 2), L("b", "2026-10-25", 20, null), L("a", "2026-10-24", 5, 1)]);
    expect(r.map((d) => d.dia)).toEqual(["2026-10-24", "2026-10-25"]);
    expect(r[1]).toMatchObject({ likes: 30, comentarios: 2, views: null, posts: 2, interacoesMedia: 16 });
  });

  it("views só existem nos dias em que foram coletadas", () => {
    const r = somaPorDia([L("a", "2026-10-26", 1, 1, 500), L("b", "2026-10-26", 1, 1, null)]);
    expect(r[0].views).toBe(500);
  });
});

describe("indicadores", () => {
  const snapshots = [
    { dia: "2026-10-24", seguidores: 1000, total_posts: 100 },
    { dia: "2026-10-26", seguidores: 1050, total_posts: 104 },
  ];
  const leituras = [L("a", "2026-10-24", 40, 10), L("a", "2026-10-26", 60, 10, 900)];
  const r = indicadores({ snapshots, leituras, periodo: "tudo", hoje: "2026-10-26" });
  const por = Object.fromEntries(r.map((i) => [i.chave, i]));

  it("traz os seis indicadores da referência, com seguidores como principal", () => {
    expect(r.map((i) => i.chave)).toEqual(["seguidores", "views", "likes", "comentarios", "posts_dia", "engajamento"]);
    expect(por.seguidores).toMatchObject({ principal: true, delta: 50, pct: 5, inicio: 1000, fim: 1050 });
  });

  it("calcula curtidas, comentários e posts por dia", () => {
    expect(por.likes).toMatchObject({ delta: 20, pct: 50, inicio: 40, fim: 60 });
    expect(por.comentarios).toMatchObject({ delta: 0, inicio: 10, fim: 10 });
    expect(por.posts_dia).toMatchObject({ delta: 2, inicio: 100, fim: 104 });
  });

  it("com uma leitura só, mostra o valor e não inventa variação", () => {
    expect(por.views).toMatchObject({ delta: null, pct: null, fim: 900, leituras: 1 });
  });

  it("engajamento é em pontos percentuais", () => {
    // 50/1000 = 5% → 70/1050 ≈ 6,667%
    expect(por.engajamento.inicio).toBeCloseTo(5);
    expect(por.engajamento.fim).toBeCloseTo(6.667, 2);
    expect(por.engajamento.delta).toBeCloseTo(1.667, 2);
    expect(por.engajamento.pct).toBeNull();
  });

  it("respeita o período", () => {
    const r30 = indicadores({ snapshots: [{ dia: "2026-08-01", seguidores: 1, total_posts: 1 }, ...snapshots], leituras, periodo: "30", hoje: "2026-10-26" });
    expect(r30[0].inicio).toBe(1000);
  });
});

describe("ultimosPosts", () => {
  const posts: PostBase[] = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i}`, publicado_em: `2026-10-${String(10 + i).padStart(2, "0")}T12:00:00Z`, produto: i % 2 ? "REELS" : "FEED",
    tipo: i % 2 ? "VIDEO" : "IMAGE", legenda: null, permalink: null,
  }));

  it("pega os 8 mais recentes em ordem cronológica, com a última leitura", () => {
    const r = ultimosPosts(posts, [L("p9", "2026-10-25", 5, 1, 100), L("p9", "2026-10-26", 9, 2, 150)]);
    expect(r).toHaveLength(8);
    expect(r[0].id).toBe("p2");
    expect(r.at(-1)).toMatchObject({ id: "p9", rotulo: "19/10", formato: "Reel", likes: 9, comentarios: 2, views: 150 });
    expect(r[0]).toMatchObject({ formato: "Foto", likes: null, views: null });
  });
});
