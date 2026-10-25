import { describe, expect, it } from "vitest";
import { limparPosicionamento } from "./estudio";

describe("limparPosicionamento", () => {
  it("mantém só perguntas conhecidas e pilares com nome", () => {
    const r = limparPosicionamento({
      respostas: { publico: "  Pessoas de 30 a 45 anos  ", hack: "x", tom: 42 },
      pilares: [{ nome: "Educação", descricao: "Explicar" }, { nome: "  ", descricao: "sem nome" }, "lixo"],
    });
    expect(r.respostas).toEqual({ publico: "Pessoas de 30 a 45 anos" });
    expect(r.pilares).toEqual([{ nome: "Educação", descricao: "Explicar" }]);
  });

  it("limita a 6 pilares", () => {
    const pilares = Array.from({ length: 9 }, (_, i) => ({ nome: `P${i}`, descricao: "" }));
    expect(limparPosicionamento({ respostas: null, pilares }).pilares).toHaveLength(6);
  });
});
