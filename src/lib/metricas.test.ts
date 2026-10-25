import { describe, expect, it } from "vitest";
import {
  caminhoSparkline,
  engajamento,
  farol,
  filtrarPeriodo,
  formatarNumero,
  formatarPct,
  formatarVariacao,
  lerPeriodo,
  postsPorDia,
  variacao,
  type Ponto,
} from "./metricas";

const serie: Ponto[] = [
  { dia: "2026-09-01", seguidores: 1000, total_posts: 100 },
  { dia: "2026-09-15", seguidores: null, total_posts: null }, // Meta não respondeu
  { dia: "2026-10-01", seguidores: 1100, total_posts: 130 },
  { dia: "2026-10-21", seguidores: 1150, total_posts: 150 },
];

describe("farol", () => {
  it.each([
    [5, "verde"],
    [2, "amarelo"],
    [-2, "amarelo"],
    [-2.1, "vermelho"],
    [null, "amarelo"],
  ] as const)("%s%% → %s", (pct, cor) => {
    expect(farol(pct)).toBe(cor);
  });
});

describe("filtrarPeriodo", () => {
  it("corta pelos últimos N dias", () => {
    expect(filtrarPeriodo(serie, "30", "2026-10-21").map((p) => p.dia)).toEqual(["2026-10-01", "2026-10-21"]);
  });
  it("mantém tudo em 'tudo'", () => {
    expect(filtrarPeriodo(serie, "tudo", "2026-10-21")).toHaveLength(4);
  });
  it("aceita só períodos conhecidos", () => {
    expect(lerPeriodo("90")).toBe("90");
    expect(lerPeriodo("7")).toBe("30");
    expect(lerPeriodo(undefined)).toBe("30");
  });
});

describe("variacao", () => {
  it("ignora dias sem leitura", () => {
    const v = variacao(serie, (p) => p.seguidores);
    expect(v).toMatchObject({ base: 1000, atual: 1150, abs: 150, pontos: 3 });
    expect(v.pct).toBeCloseTo(15);
  });
  it("sem leitura devolve nulos", () => {
    expect(variacao([{ dia: "x", seguidores: null, total_posts: null }], (p) => p.seguidores).abs).toBeNull();
  });
  it("base zero não inventa porcentagem", () => {
    expect(variacao([{ v: 0 }, { v: 10 }], (p) => p.v).pct).toBeNull();
  });
});

describe("postsPorDia", () => {
  it("calcula pela diferença do total de posts", () => {
    expect(postsPorDia(serie)).toBeCloseTo(50 / 50);
  });
  it("precisa de dois pontos", () => {
    expect(postsPorDia(serie.slice(0, 1))).toBeNull();
  });
});

describe("engajamento", () => {
  it("média de interações por post sobre seguidores", () => {
    expect(engajamento([{ likes: 90, comentarios: 10 }, { likes: null, comentarios: 0 }], 1000)).toBeCloseTo(5);
  });
  it("sem seguidores ou posts é null", () => {
    expect(engajamento([], 1000)).toBeNull();
    expect(engajamento([{ likes: 1, comentarios: 1 }], 0)).toBeNull();
  });
});

describe("formatação", () => {
  it("números em pt-BR", () => {
    expect(formatarNumero(1234)).toBe("1.234");
    expect(formatarNumero(79400)).toMatch(/79,4\s?mil/);
    expect(formatarNumero(null)).toBe("—");
  });
  it("variações com sinal", () => {
    expect(formatarVariacao(363)).toBe("+363");
    expect(formatarVariacao(-20)).toBe("−20");
    expect(formatarVariacao(0)).toBe("sem variação");
  });
  it("porcentagem com vírgula", () => {
    expect(formatarPct(0.134, 2)).toBe("0,13%");
  });
});

describe("caminhoSparkline", () => {
  it("começa na esquerda e termina na direita", () => {
    const c = caminhoSparkline([1, 3, 2], 100, 40);
    expect(c.linha.startsWith("M0.0,")).toBe(true);
    expect(c.ultimo?.x).toBe(100);
  });
  it("valores iguais ficam no meio", () => {
    expect(caminhoSparkline([5, 5], 100, 40).ultimo?.y).toBe(20);
  });
  it("vazio não desenha", () => {
    expect(caminhoSparkline([], 100, 40).linha).toBe("");
  });
});
