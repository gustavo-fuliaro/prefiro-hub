import { describe, expect, it } from "vitest";
import {
  avaliarRegra, cnpjValido, cpfValido, lerSlug, limparCondicoes, metricas, novaPergunta, perguntasVisiveis, problemaResposta,
  problemasFormulario, respostasParaCsv, type Pergunta,
} from "./formularios";

const q = (p: Partial<Pergunta> & { id: string }): Pergunta => ({ tipo: "texto_curto", titulo: "T", obrigatoria: true, ...p });

describe("lógica de pulo", () => {
  const perguntas: Pergunta[] = [
    q({ id: "a", tipo: "escolha_unica", opcoes: ["Sim", "Não"] }),
    q({ id: "b", condicao: { logica: "e", regras: [{ pergunta: "a", operador: "igual", valor: "Sim" }] } }),
    q({ id: "c", tipo: "numero" }),
    q({ id: "d", condicao: { logica: "ou", regras: [{ pergunta: "c", operador: "maior", valor: "100" }, { pergunta: "a", operador: "igual", valor: "Não" }] } }),
  ];
  it("mostra só o que as regras liberam", () => {
    expect(perguntasVisiveis(perguntas, { a: "Sim", c: "50" }).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(perguntasVisiveis(perguntas, { a: "Não", c: "50" }).map((p) => p.id)).toEqual(["a", "c", "d"]);
    expect(perguntasVisiveis(perguntas, { a: "Sim", c: "150,5" }).map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("operadores como o banco", () => {
    expect(avaliarRegra({ pergunta: "x", operador: "contem", valor: "IMÓ" }, { x: "Carta de imóvel" })).toBe(true);
    expect(avaliarRegra({ pergunta: "x", operador: "igual", valor: "B" }, { x: ["A", "B"] })).toBe(true);
    expect(avaliarRegra({ pergunta: "x", operador: "vazia", valor: "" }, {})).toBe(true);
    expect(avaliarRegra({ pergunta: "x", operador: "maior", valor: "10" }, { x: "abc" })).toBe(false);
  });
  it("remove regras que apontam para pergunta que sumiu ou ficou depois", () => {
    const movidas = limparCondicoes([perguntas[1], perguntas[0]]);
    expect(movidas[0].condicao).toBeNull();
  });
});

describe("validação das respostas", () => {
  it("documentos e contato", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
    expect(problemaResposta(q({ id: "e", tipo: "email" }), "x@y")).toBe("Confira o e-mail.");
    expect(problemaResposta(q({ id: "t", tipo: "telefone" }), "(11) 99999-0000")).toBeNull();
    expect(problemaResposta(q({ id: "i", tipo: "instagram" }), "https://instagram.com/fulano.silva")).toBeNull();
    expect(problemaResposta(q({ id: "i", tipo: "instagram" }), "nome com espaço")).not.toBeNull();
  });
  it("obrigatória, termos e telas", () => {
    expect(problemaResposta(q({ id: "x" }), "")).toBe("Esta pergunta é obrigatória.");
    expect(problemaResposta(q({ id: "x", obrigatoria: false }), "")).toBeNull();
    expect(problemaResposta(q({ id: "t", tipo: "termos" }), "")).toBe("É preciso aceitar para continuar.");
    expect(problemaResposta(q({ id: "t", tipo: "termos" }), "aceito")).toBeNull();
    expect(problemaResposta(q({ id: "w", tipo: "boas_vindas" }), undefined)).toBeNull();
  });
});

describe("antes de publicar", () => {
  const base = { titulo: "Isca", pipeline_id: null as number | null, etapa_id: null as number | null };
  it("exige o @ obrigatório quando cria lead no funil", () => {
    const perguntas = [q({ id: "n", tipo: "nome" })];
    expect(problemasFormulario({ ...base, perguntas }, null)).toEqual([]);
    const p = problemasFormulario({ ...base, perguntas, pipeline_id: 1, etapa_id: 2 }, { nome: "Novo", papel: "entrada", exige: "nada" });
    expect(p.some((x) => x.includes("Instagram"))).toBe(true);
  });
  it("recusa etapa que pede motivo e cobra contato na que pede", () => {
    const perguntas = [q({ id: "i", tipo: "instagram" })];
    const f = { ...base, perguntas, pipeline_id: 1, etapa_id: 2 };
    expect(problemasFormulario(f, { nome: "Qualificado", papel: "trabalho", exige: "justificativa" })[0]).toContain("não recebe");
    expect(problemasFormulario(f, { nome: "Agendado", papel: "meta", exige: "contato" })[0]).toContain("telefone e e-mail");
  });
  it("opções e qualificação", () => {
    const perguntas = [q({ id: "e", tipo: "escolha_unica", titulo: "Compra?", opcoes: ["Sim", "Sim"], qualificacao: { ativa: true, qualifica: [false, false] } })];
    const p = problemasFormulario({ ...base, perguntas }, null);
    expect(p).toContain('"Compra?" tem opções repetidas.');
    expect(p).toContain('Marque ao menos uma opção que qualifica em "Compra?".');
  });
  it("pergunta nova já vem pronta para usar", () => {
    expect(novaPergunta("escolha_unica").opcoes).toHaveLength(2);
    expect(novaPergunta("boas_vindas").obrigatoria).toBe(false);
    expect(novaPergunta("instagram").obrigatoria).toBe(true);
  });
});

describe("endereço, métricas e CSV", () => {
  it("lê o endereço do formulário", () => {
    expect(lerSlug("Simulação Imóvel 2026")).toBe("simulacao-imovel-2026");
    expect(lerSlug("ab")).toBeNull();
  });
  it("calcula conversão e abandono", () => {
    const m = metricas(10, [
      { respostas: { a: "x" }, concluido_em: "t", qualificado: true },
      { respostas: { a: "x" }, concluido_em: null, qualificado: null },
      { respostas: {}, concluido_em: null, qualificado: null },
    ]);
    expect(m).toMatchObject({ visitas: 10, iniciadas: 2, concluidas: 1, qualificadas: 1, conversao: 0.1, abandono: 0.5 });
    expect(metricas(0, []).conversao).toBeNull();
  });
  it("exporta CSV seguro para o Excel", () => {
    const csv = respostasParaCsv(
      [q({ id: "a", titulo: "Nome" }), q({ id: "b", tipo: "multipla_escolha", titulo: "Interesse" })],
      [{ id: 1, respostas: { a: "=SOMA(1;2)", b: ["Carro", "Imóvel"] }, origem: { utm_source: "ig" }, iniciado_em: "", concluido_em: "2026-11-09T15:00:00Z", qualificado: true, lead_id: 1, lead_status: "criado", lead_erro: null }],
      "America/Sao_Paulo",
    );
    expect(csv.startsWith("﻿Enviado em;Situação;Qualificado;Nome;Interesse;Origem")).toBe(true);
    expect(csv).toContain("\"'=SOMA(1;2)\"");
    expect(csv).toContain("Carro, Imóvel");
    expect(csv).toContain("utm_source=ig");
  });
});
