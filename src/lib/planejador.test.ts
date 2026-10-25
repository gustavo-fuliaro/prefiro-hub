import { describe, expect, it } from "vitest";
import {
  agruparPorColuna,
  colunaAnterior,
  colunaSeguinte,
  deslocarMes,
  gradeDoMes,
  lerFormIdeia,
  lerMes,
  limparChecklist,
  paraTimestampSP,
  partesSP,
  porDia,
  progressoChecklist,
  reordenar,
  type Ideia,
} from "./planejador";

function form(campos: Record<string, string>) {
  const fd = new FormData();
  Object.entries(campos).forEach(([k, v]) => fd.set(k, v));
  return fd;
}

const base = { titulo: "Consórcio não é investimento?", perfil_id: "3", coluna: "garagem" };

describe("lerFormIdeia", () => {
  it("aceita o mínimo", () => {
    const r = lerFormIdeia(form(base));
    expect("dados" in r && r.dados).toMatchObject({ titulo: base.titulo, perfil_id: 3, coluna: "garagem", referencias: [], publicar_em: null });
  });

  it("exige título, perfil e coluna válida", () => {
    expect(lerFormIdeia(form({ ...base, titulo: "  " }))).toEqual({ erro: "Dê um título para a ideia." });
    expect(lerFormIdeia(form({ ...base, perfil_id: "x" }))).toEqual({ erro: "Escolha o perfil." });
    expect(lerFormIdeia(form({ ...base, coluna: "outra" }))).toEqual({ erro: "Coluna inválida." });
  });

  it("valida referências e descarta campos desconhecidos", () => {
    expect(lerFormIdeia(form({ ...base, referencias: "https://a.com javascript:alert(1)" }))).toEqual({
      erro: "Referência não é um link válido: javascript:alert(1)",
    });
    const r = lerFormIdeia(form({ ...base, referencias: "https://a.com\nhttps://b.com", ambiente: "lua", status_producao: "gravado" }));
    expect("dados" in r && r.dados.referencias).toEqual(["https://a.com", "https://b.com"]);
    expect("dados" in r && r.dados.ambiente).toBeNull();
    expect("dados" in r && r.dados.status_producao).toBe("gravado");
  });

  it("converte data e hora de Brasília", () => {
    const r = lerFormIdeia(form({ ...base, data: "2026-10-28", hora: "19:30" }));
    expect("dados" in r && r.dados.publicar_em).toBe("2026-10-28T22:30:00.000Z");
    expect(lerFormIdeia(form({ ...base, data: "28/10/2026" }))).toEqual({ erro: "Data de postagem inválida." });
  });
});

describe("datas", () => {
  it("usa 09:00 quando falta a hora", () => {
    expect(paraTimestampSP("2026-10-28", "")).toBe("2026-10-28T12:00:00.000Z");
  });
  it("volta para data e hora de Brasília", () => {
    expect(partesSP("2026-10-29T01:15:00.000Z")).toEqual({ data: "2026-10-28", hora: "22:15" });
  });
});

const ideia = (id: number, coluna: Ideia["coluna"], ordem: number, publicar_em: string | null = null): Ideia => ({
  id, perfil_id: 1, titulo: `#${id}`, gancho: null, tese: null, cta: null, formato: null, pilar: null, ambiente: null,
  coluna, status_producao: null, ordem, publicar_em, referencias: [], post_id: null,
});

describe("quadro", () => {
  it("agrupa e ordena por coluna", () => {
    const g = agruparPorColuna([ideia(1, "pista", 20), ideia(2, "pista", 10), ideia(3, "garagem", 0)]);
    expect(g.pista.map((i) => i.id)).toEqual([2, 1]);
    expect(g.garagem.map((i) => i.id)).toEqual([3]);
    expect(g.chegada).toEqual([]);
  });

  it("reordena ao soltar", () => {
    expect(reordenar([1, 2, 3], 3, 0)).toEqual([3, 1, 2]);
    expect(reordenar([1, 2, 3], 1, 99)).toEqual([2, 3, 1]);
    expect(reordenar([1, 2], 9, 1)).toEqual([1, 9, 2]); // vindo de outra coluna
  });

  it("navega entre colunas", () => {
    expect(colunaSeguinte("garagem")).toBe("pista");
    expect(colunaSeguinte("chegada")).toBeNull();
    expect(colunaAnterior("garagem")).toBeNull();
  });
});

describe("calendário", () => {
  it("monta semanas de domingo a sábado cobrindo o mês", () => {
    const g = gradeDoMes("2026-10", "2026-10-24");
    expect(g[0][0].data).toBe("2026-09-27"); // 1/10/2026 é quinta
    expect(g.at(-1)!.at(-1)!.data).toBe("2026-10-31");
    expect(g.flat().find((d) => d.hoje)?.data).toBe("2026-10-24");
    expect(g.flat().filter((d) => d.doMes)).toHaveLength(31);
  });

  it("lê e desloca meses", () => {
    expect(lerMes("2026-13", "2026-10-24")).toBe("2026-10");
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
  });

  it("agrupa por dia de Brasília", () => {
    const m = porDia([ideia(1, "garagem", 0, "2026-10-29T01:00:00Z"), ideia(2, "garagem", 0, null)]);
    expect([...m.keys()]).toEqual(["2026-10-28"]);
  });
});

describe("checklist", () => {
  it("conta o progresso", () => {
    expect(progressoChecklist({ antes_0: true, gravacao_1: true, x: true })).toEqual({ feitos: 2, total: 14, pct: 14 });
    expect(progressoChecklist(null).feitos).toBe(0);
  });
  it("descarta chaves e valores desconhecidos", () => {
    expect(limparChecklist({ antes_0: true, antes_1: "sim", hack: true, publicacao_4: true })).toEqual({ antes_0: true, publicacao_4: true });
    expect(limparChecklist("x")).toEqual({});
  });
});
