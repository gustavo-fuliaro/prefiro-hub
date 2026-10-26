import { describe, expect, it } from "vitest";
import { destaques, diferenca, isDataIso, lerRelatorio, linhasPerfis, progressoMeta, rotuloSemana, segundaDaSemana, totais, type PerfilRel } from "./relatorio";

const perfil = (o: Partial<PerfilRel>): PerfilRel => ({
  id: 1, handle: "a", nome: null, grupo: "proprio", seguidores_inicio: 1000, seguidores_fim: 1100, dias_coletados: 7, posts: 2, interacoes: 50, ...o,
});

describe("lerRelatorio", () => {
  it("aceita lixo sem quebrar", () => {
    expect(lerRelatorio(null)).toEqual({ perfis: [], top_posts: [], metas: [], ideias_publicadas: [], alertas: {} });
    expect(lerRelatorio([1, 2]).perfis).toEqual([]);
  });

  it("converte números vindos como texto (numeric do Postgres) e descarta itens inválidos", () => {
    const r = lerRelatorio({
      perfis: [{ id: 4, handle: "x", seguidores_inicio: "10", seguidores_fim: 12, posts: 1 }, { handle: "sem-id" }, "lixo"],
      metas: [{ id: 1, handle: "x", metrica: "seguidores", alvo: "2000", prazo: "2026-12-31", base: null, atual: "1500.0" }],
      alertas: { post_destaque: 2, ruim: "abc" },
    });
    expect(r.perfis).toHaveLength(1);
    expect(r.perfis[0]).toMatchObject({ seguidores_inicio: 10, seguidores_fim: 12, dias_coletados: 0, interacoes: 0 });
    expect(r.metas[0]).toMatchObject({ alvo: 2000, atual: 1500 });
    expect(r.alertas).toEqual({ post_destaque: 2 });
  });
});

describe("linhasPerfis e totais", () => {
  it("calcula ganho, crescimento, participação e média por post", () => {
    const l = linhasPerfis([
      perfil({ id: 1, handle: "a", seguidores_inicio: 1000, seguidores_fim: 1100 }),
      perfil({ id: 2, handle: "b", seguidores_inicio: 500, seguidores_fim: 800, posts: 0, interacoes: 0, dias_coletados: 3 }),
      perfil({ id: 3, handle: "c", seguidores_inicio: 900, seguidores_fim: 850 }),
    ]);
    expect(l.map((x) => x.ganho)).toEqual([100, 300, -50]);
    expect(l[0].crescimentoPct).toBeCloseTo(10);
    // Negativos não entram na soma: 100 / (100 + 300)
    expect(l[0].shareCrescimento).toBeCloseTo(0.25);
    expect(l[2].shareCrescimento).toBe(0);
    expect(l[0].mediaInteracoes).toBe(25);
    expect(l[1].mediaInteracoes).toBeNull();
    expect(l[1].coberturaIncompleta).toBe(true);
    expect(totais(l)).toEqual({ seguidores: 2750, ganho: 350, posts: 4, interacoes: 100 });
  });

  it("sem leitura de seguidores não inventa ganho", () => {
    const l = linhasPerfis([perfil({ seguidores_inicio: null })]);
    expect(l[0].ganho).toBeNull();
    expect(l[0].shareCrescimento).toBeNull();
    expect(totais(l).ganho).toBeNull();
  });
});

describe("progressoMeta", () => {
  const meta = { id: 1, handle: "a", metrica: "seguidores", alvo: 2000, prazo: "2026-12-31", base: 1000, atual: 1500 };
  it("mede do ponto de partida até o alvo", () => {
    expect(progressoMeta(meta)).toBe(50);
    expect(progressoMeta({ ...meta, atual: 2500 })).toBe(100);
    expect(progressoMeta({ ...meta, atual: 900 })).toBe(0);
    expect(progressoMeta({ ...meta, atual: null })).toBeNull();
    expect(progressoMeta({ ...meta, base: null, atual: 500 })).toBe(25);
  });
});

describe("destaques", () => {
  it("cita quem cresceu, quem caiu, quem não postou e o melhor post", () => {
    const l = linhasPerfis([
      perfil({ id: 1, handle: "a", seguidores_inicio: 1000, seguidores_fim: 1200 }),
      perfil({ id: 2, handle: "b", seguidores_inicio: 1000, seguidores_fim: 990, posts: 0 }),
    ]);
    const f = destaques(l, [{ id: "p", handle: "a", produto: null, tipo: null, legenda: null, permalink: null, thumb_path: null, publicado_em: null, likes: 10, comentarios: 2, interacoes: 1234 }]);
    expect(f).toEqual([
      "@a foi quem mais ganhou seguidores: +200.",
      "@b perdeu seguidores no período.",
      "@b não publicou nada.",
      "Melhor post: @a, com 1.234 interações.",
    ]);
  });

  it("não afirma crescimento quando ninguém cresceu", () => {
    expect(destaques(linhasPerfis([perfil({ seguidores_inicio: 10, seguidores_fim: 10 })]), [])).toEqual([]);
  });
});

describe("datas e diferença", () => {
  it("acha a segunda-feira", () => {
    expect(segundaDaSemana("2026-10-24")).toBe("2026-10-19"); // sábado
    expect(segundaDaSemana("2026-10-19")).toBe("2026-10-19"); // segunda
    expect(segundaDaSemana("2026-10-25")).toBe("2026-10-19"); // domingo
  });
  it("formata a semana e valida datas", () => {
    expect(rotuloSemana("2026-10-19", "2026-10-25")).toBe("19/10 a 25/10");
    expect(isDataIso("2026-10-19")).toBe(true);
    expect(isDataIso("19/10/2026")).toBe(false);
    expect(isDataIso("2026-13-40")).toBe(false);
  });
  it("diferença só existe com base", () => {
    expect(diferenca(10, 4)).toBe(6);
    expect(diferenca(10, null)).toBeNull();
    expect(diferenca(null, 3)).toBeNull();
    expect(diferenca(10, undefined)).toBeNull();
  });
});
