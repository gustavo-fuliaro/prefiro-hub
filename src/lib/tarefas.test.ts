import { describe, expect, it } from "vitest";
import {
  colunaDe, dadosDuplicados, dataCurta, descreverEvento, estaAtrasada, FILTROS_PADRAO, filtrar, hojeNoFuso, lerData, lerLink,
  mudancaConcluir, mudancaReabrir, ordemEntre, ordenar, statusAoSoltar, type Tarefa,
} from "./tarefas";

const base: Tarefa = {
  id: 1, conta_id: 1, titulo: "Reel do consórcio", status: "roteirizacao", responsavel: null, vencimento: null,
  link_roteiro: null, link_drive: null, data_publicacao: null, ordem: 10, concluida_em: null, publicado_em: null,
  arquivada_em: null, arquivada_auto: false, restaurada_em: null, criado_em: "2026-10-20T10:00:00Z", criado_por: null,
  atualizado_em: "2026-10-20T10:00:00Z", atualizado_por: null,
};
const t = (x: Partial<Tarefa>): Tarefa => ({ ...base, ...x });

describe("colunas e status", () => {
  it("agendado e publicado dividem a última coluna", () => {
    expect(colunaDe("agendado")).toBe("final");
    expect(colunaDe("publicado")).toBe("final");
    expect(colunaDe("edicao")).toBe("edicao");
  });
  it("soltar na última coluna agenda, sem publicar sozinho", () => {
    expect(statusAoSoltar("final", "pronto")).toBe("agendado");
    expect(statusAoSoltar("final", "publicado")).toBe("publicado");
    expect(statusAoSoltar("gravacao", "publicado")).toBe("gravacao");
  });
});

describe("atraso", () => {
  it("só atrasa com data vencida, sem conclusão e fora do arquivo", () => {
    expect(estaAtrasada(t({ vencimento: "2026-10-25" }), "2026-10-26")).toBe(true);
    expect(estaAtrasada(t({ vencimento: "2026-10-26" }), "2026-10-26")).toBe(false);
    expect(estaAtrasada(t({ vencimento: "2026-10-25", concluida_em: "x" }), "2026-10-26")).toBe(false);
    expect(estaAtrasada(t({ vencimento: "2026-10-25", arquivada_em: "x" }), "2026-10-26")).toBe(false);
    expect(estaAtrasada(t({}), "2026-10-26")).toBe(false);
  });
  it("usa o dia no fuso do ambiente", () => {
    expect(hojeNoFuso("America/Sao_Paulo", new Date("2026-10-27T02:00:00Z"))).toBe("2026-10-26");
  });
});

describe("validação de campos", () => {
  it("aceita só links http/https", () => {
    expect(lerLink("")).toBeNull();
    expect(lerLink(" https://drive.google.com/x ")).toBe("https://drive.google.com/x");
    expect(lerLink("javascript:alert(1)")).toBe(false);
    expect(lerLink("drive.google.com")).toBe(false);
  });
  it("valida datas reais", () => {
    expect(lerData("2026-02-30")).toBe(false);
    expect(lerData("2026-10-26")).toBe("2026-10-26");
    expect(lerData("")).toBeNull();
  });
});

describe("filtros e ordenação", () => {
  const lista = [
    t({ id: 1, titulo: "Reel Imóvel", responsavel: "a", vencimento: "2026-10-20", ordem: 3 }),
    t({ id: 2, titulo: "Carrossel Auto", status: "edicao", vencimento: "2026-11-02", ordem: 1, criado_em: "2026-10-22T00:00:00Z" }),
    t({ id: 3, titulo: "Stories", responsavel: "b", data_publicacao: "2026-10-28", ordem: 2, criado_em: "2026-10-21T00:00:00Z" }),
  ];
  const hoje = "2026-10-26";
  it("busca sem acento e filtra por responsável, status e atraso", () => {
    expect(filtrar(lista, { ...FILTROS_PADRAO, busca: "imovel" }, hoje).map((x) => x.id)).toEqual([1]);
    expect(filtrar(lista, { ...FILTROS_PADRAO, responsavel: "sem" }, hoje).map((x) => x.id)).toEqual([2]);
    expect(filtrar(lista, { ...FILTROS_PADRAO, status: "edicao" }, hoje).map((x) => x.id)).toEqual([2]);
    expect(filtrar(lista, { ...FILTROS_PADRAO, atrasadas: true }, hoje).map((x) => x.id)).toEqual([1]);
  });
  it("período vale para a data da tarefa ou da publicação", () => {
    expect(filtrar(lista, { ...FILTROS_PADRAO, de: "2026-10-27", ate: "2026-10-31" }, hoje).map((x) => x.id)).toEqual([3]);
  });
  it("ordena por vencimento (sem data no fim), criação e manual", () => {
    expect(ordenar(lista, "vencimento").map((x) => x.id)).toEqual([1, 2, 3]);
    expect(ordenar(lista, "criacao").map((x) => x.id)).toEqual([2, 3, 1]);
    expect(ordenar(lista, "manual").map((x) => x.id)).toEqual([2, 3, 1]);
  });
  it("calcula a posição entre vizinhos", () => {
    expect(ordemEntre(1, 3)).toBe(2);
    expect(ordemEntre(undefined, 3)).toBe(2);
    expect(ordemEntre(5, undefined)).toBe(6);
    expect(ordemEntre(undefined, undefined, 100)).toBe(100);
  });
});

describe("ações", () => {
  it("duplica sem conclusão nem publicação", () => {
    const d = dadosDuplicados(t({ status: "publicado", concluida_em: "x", link_drive: "https://d" }));
    expect(d.status).toBe("agendado");
    expect(d).not.toHaveProperty("concluida_em");
    expect(d.link_drive).toBe("https://d");
    expect(d.titulo).toContain("(cópia)");
  });
  it("concluir publica o que está agendado e reabrir tira a publicação", () => {
    expect(mudancaConcluir({ status: "agendado" }, "agora")).toEqual({ status: "publicado" });
    expect(mudancaConcluir({ status: "edicao" }, "agora")).toEqual({ concluida_em: "agora" });
    expect(mudancaReabrir({ status: "publicado" })).toEqual({ status: "agendado", concluida_em: null });
    expect(mudancaReabrir({ status: "pronto" })).toEqual({ concluida_em: null });
  });
  it("descreve o histórico com nomes", () => {
    const nomes = new Map([["u1", "Ana"]]);
    const e = { id: 1, tarefa_id: 1, de: null, para: "u1", autor_nome: "Bia", criado_em: "" };
    expect(descreverEvento({ ...e, tipo: "responsavel" }, nomes)).toContain("Ana");
    expect(descreverEvento({ ...e, tipo: "status", de: "pronto", para: "agendado" }, nomes)).toBe("moveu de Pronto para postar para Agendado");
    expect(descreverEvento({ ...e, tipo: "arquivada", para: "automatico" }, nomes)).toContain("automaticamente");
  });
  it("formata data curta", () => {
    expect(dataCurta("2026-10-26")).toMatch(/26 out/);
    expect(dataCurta(null)).toBe("");
  });
});
