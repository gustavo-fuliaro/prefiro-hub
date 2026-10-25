import { describe, expect, it } from "vitest";
import { ESQUEMAS, completudePosicionamento, isTipoGeracao, montarPedido, validarSaida, type ContextoPerfil } from "./estudio";

const ctx: ContextoPerfil = {
  handle: "prefiroconsorcio",
  nome: "Prefiro Consórcio",
  bio: "Consórcio sem enrolação",
  seguidores: 14364,
  posicionamento: {
    respostas: { publico: "Profissionais de 30 a 45 anos que querem o primeiro imóvel sem financiamento." },
    pilares: [{ nome: "Educação financeira", descricao: "Explicar como o consórcio funciona" }, { nome: " ", descricao: "vazio" }],
  },
  melhoresPosts: [{ tipo: "VIDEO", legenda: "Minhas parcelas\naumentaram", interacoes: 120, publicado_em: "2026-10-20T15:00:00Z" }],
  ideiasExistentes: ["A menor taxa é a escolha errada"],
};

describe("esquemas", () => {
  it("são estritos em todos os níveis", () => {
    const verificar = (s: Record<string, unknown>): void => {
      if (s.type === "object") {
        expect(s.additionalProperties).toBe(false);
        expect((s.required as string[]).sort()).toEqual(Object.keys(s.properties as object).sort());
        Object.values(s.properties as Record<string, Record<string, unknown>>).forEach(verificar);
      }
      if (s.type === "array") verificar(s.items as Record<string, unknown>);
    };
    Object.values(ESQUEMAS).forEach(verificar);
  });
});

describe("montarPedido", () => {
  it("inclui posicionamento, pilares válidos, posts e ideias existentes", () => {
    const p = montarPedido("ideias", ctx, { quantidade: 50, contexto: "Foco em imóveis" });
    expect(p).toContain("@prefiroconsorcio");
    expect(p).toContain("Educação financeira");
    expect(p).not.toContain("vazio");
    expect(p).toContain("Minhas parcelas aumentaram");
    expect(p).toContain("A menor taxa é a escolha errada");
    expect(p).toContain("Foco em imóveis");
    expect(p).toContain("Crie 15 ideias"); // limitado a 15
  });

  it("roteiro escolhe carrossel pelo formato e exige ideia", () => {
    const p = montarPedido("roteiro", ctx, { ideia: { titulo: "X", gancho: null, tese: null, formato: "Carrossel", cta: null } });
    expect(p).toContain("como carrossel");
    expect(() => montarPedido("roteiro", ctx, {})).toThrow("Escolha a ideia");
  });

  it("sem pilares pede sugestão", () => {
    expect(montarPedido("analise", { ...ctx, posicionamento: null }, {})).toContain("Não definidos");
  });
});

describe("validação", () => {
  it("reconhece tipos e saídas", () => {
    expect(isTipoGeracao("ideias")).toBe(true);
    expect(isTipoGeracao("hasOwnProperty")).toBe(false);
    expect(validarSaida("ideias", { ideias: [] })).toBe(false);
    expect(validarSaida("roteiro", { tipo: "reel", legenda: "x" })).toBe(true);
    expect(validarSaida("analise", null)).toBe(false);
  });

  it("calcula a completude do posicionamento", () => {
    expect(completudePosicionamento(ctx.posicionamento)).toMatchObject({ respondidas: 1, pilares: 1, pronto: false });
  });
});
