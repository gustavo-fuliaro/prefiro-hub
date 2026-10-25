import { describe, expect, it } from "vitest";
import { avaliarMeta, crescimentoAcumulado, lerFormMeta, participacoes, resumir, ritmoDiario, type Snapshot } from "./comparativo";

const s = (perfil_id: number, dia: string, seguidores: number | null, total_posts: number | null): Snapshot => ({ perfil_id, dia, seguidores, total_posts });

describe("resumir", () => {
  it("calcula ganho, crescimento, posts e engajamento", () => {
    const r = resumir(1, [s(1, "2026-10-01", 1000, 100), s(1, "2026-10-15", null, null), s(1, "2026-10-31", 1100, 110)], 33);
    expect(r).toMatchObject({ seguidoresInicio: 1000, seguidoresFim: 1100, ganho: 100, postsNoPeriodo: 10 });
    expect(r.crescimentoPct).toBeCloseTo(10);
    expect(r.engajamentoPct).toBeCloseTo(3);
  });
  it("um único ponto não tem ganho", () => {
    expect(resumir(1, [s(1, "2026-10-01", 1000, 100)], null)).toMatchObject({ ganho: null, crescimentoPct: null, postsNoPeriodo: null });
  });
});

describe("participacoes", () => {
  const a = resumir(1, [s(1, "2026-10-01", 9000, 10), s(1, "2026-10-31", 9300, 20)], 90);
  const b = resumir(2, [s(2, "2026-10-01", 1000, 5), s(2, "2026-10-31", 1100, 35)], 10);
  const c = resumir(3, [s(3, "2026-10-01", 500, 1), s(3, "2026-10-31", 450, 1)], null);
  const p = participacoes([a, b, c]);

  it("divide a audiência pelo total", () => {
    expect(p.get(1)!.audiencia).toBeCloseTo(9300 / 10850);
  });
  it("ignora perda no total de crescimento", () => {
    expect(p.get(1)!.crescimento).toBeCloseTo(300 / 400);
    expect(p.get(3)!.crescimento).toBe(0);
  });
  it("voz conta posts no período", () => {
    expect(p.get(2)!.voz).toBeCloseTo(30 / 40);
  });
  it("sem dados fica null", () => {
    expect(p.get(3)!.engajamento).toBeNull();
  });
});

describe("crescimentoAcumulado", () => {
  it("normaliza pelo primeiro dia", () => {
    expect(crescimentoAcumulado([s(1, "2026-10-02", 1100, 0), s(1, "2026-10-01", 1000, 0)])).toEqual([
      { dia: "2026-10-01", pct: 0 },
      { dia: "2026-10-02", pct: 10 },
    ]);
  });
});

describe("metas", () => {
  const hoje = "2026-10-24";
  it("no ritmo quando a previsão cabe no prazo", () => {
    const r = avaliarMeta({ base: 1000, atual: 1500, alvo: 2000, hoje, prazo: "2026-12-31", ritmoDiario: 10 });
    expect(r).toMatchObject({ progressoPct: 50, status: "no_ritmo", previsao: "2026-12-13", faltam: 500 });
  });
  it("fora do ritmo quando passa do prazo", () => {
    expect(avaliarMeta({ base: 1000, atual: 1500, alvo: 2000, hoje, prazo: "2026-11-30", ritmoDiario: 10 }).status).toBe("atrasada");
  });
  it("atingida, vencida e sem dados", () => {
    expect(avaliarMeta({ base: 0, atual: 2000, alvo: 2000, hoje, prazo: "2026-11-30", ritmoDiario: 0 }).status).toBe("atingida");
    expect(avaliarMeta({ base: 0, atual: 10, alvo: 2000, hoje, prazo: "2026-10-01", ritmoDiario: 5 }).status).toBe("vencida");
    expect(avaliarMeta({ base: 0, atual: null, alvo: 2000, hoje, prazo: "2026-11-30", ritmoDiario: 5 }).status).toBe("sem_dados");
    expect(avaliarMeta({ base: 0, atual: 10, alvo: 2000, hoje, prazo: "2026-11-30", ritmoDiario: -3 }).status).toBe("atrasada");
  });
  it("ritmo diário pela janela", () => {
    const serie = [
      { dia: "2026-09-01", valor: 0 },
      { dia: "2026-10-04", valor: 100 },
      { dia: "2026-10-24", valor: 300 },
    ];
    expect(ritmoDiario(serie, hoje)).toBeCloseTo(10);
    expect(ritmoDiario(serie.slice(2), hoje)).toBeNull();
  });
  it("lê o formulário", () => {
    const fd = new FormData();
    Object.entries({ perfil_id: "2", metrica: "seguidores", alvo: "20.000", prazo: "2026-12-31" }).forEach(([k, v]) => fd.set(k, v));
    expect(lerFormMeta(fd, hoje)).toEqual({ dados: { perfil_id: 2, metrica: "seguidores", alvo: 20000, prazo: "2026-12-31" } });
    fd.set("prazo", "2026-10-01");
    expect(lerFormMeta(fd, hoje)).toEqual({ erro: "O prazo precisa ser uma data futura." });
    fd.set("metrica", "engajamento");
    fd.set("alvo", "150");
    fd.set("prazo", "2026-12-31");
    expect(lerFormMeta(fd, hoje)).toEqual({ erro: "Engajamento é uma porcentagem (até 100)." });
  });
});
