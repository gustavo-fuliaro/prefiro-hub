import { describe, expect, it } from "vitest";
import {
  colunasDoQuadro, descreverEventoLead, etapaDoPapel, etapaFollowUp, faltaParaEntrar, filtrarLeads, formatarDuracao, FILTROS_LEAD_PADRAO,
  lerDuracao, lerHandleLead, linkWhatsApp, ordenarLeads, papelDaColuna, papelLeads, podeAssumir, podeMexer, problemasColunas,
  rotuloPrazo, separarDuracao, situacaoPrazo, type Etapa, type Lead,
} from "./leads";

const etapa = (p: Partial<Etapa>): Etapa => ({ id: 1, pipeline_id: 1, nome: "x", cor: "#94a3b8", posicao: 1, papel: "trabalho", prazo_h: 48, exige: "nada", ...p });
const etapas: Etapa[] = [
  etapa({ id: 6, nome: "Base Geral", posicao: 90, papel: "reservatorio", prazo_h: null }),
  etapa({ id: 2, nome: "Follow-up", posicao: 2 }),
  etapa({ id: 1, nome: "Novo", posicao: 1, papel: "entrada", prazo_h: 72 }),
  etapa({ id: 4, nome: "Agendado", posicao: 4, papel: "meta", exige: "contato" }),
  etapa({ id: 7, nome: "Desqualificado", posicao: 91, papel: "terminal", prazo_h: null }),
];

const lead = (p: Partial<Lead>): Lead => ({
  id: 1, conta_id: 1, pipeline_id: 1, etapa_id: 1, perfil_id: null, handle: "fulano", nome: null, telefone: null, email: null,
  prioridade: "normal", observacao: null, tags: [], responsavel: null, assumido_em: null, justificativa: null, data_retorno: null,
  etapa_desde: "2026-11-01T12:00:00Z", funil_desde: "2026-11-01T12:00:00Z", expira_em: null, expirado_em: null,
  criado_em: "2026-11-01T12:00:00Z", criado_por: null, atualizado_em: "2026-11-01T12:00:00Z", ...p,
});

describe("etapas", () => {
  it("quadro sem Base Geral e Desqualificado, na ordem", () => {
    expect(colunasDoQuadro(etapas).map((e) => e.nome)).toEqual(["Novo", "Follow-up", "Agendado"]);
  });
  it("acha etapas pelo papel e o follow-up", () => {
    expect(etapaDoPapel(etapas, "reservatorio")?.id).toBe(6);
    expect(etapaFollowUp(etapas)?.nome).toBe("Follow-up");
  });
  it("diz o que falta para entrar", () => {
    expect(faltaParaEntrar({ exige: "contato" }, lead({ telefone: "11999990000" }))).toBe("contato");
    expect(faltaParaEntrar({ exige: "contato" }, lead({ telefone: "1", email: "a@b.co" }))).toBeNull();
    expect(faltaParaEntrar({ exige: "justificativa" }, lead({ justificativa: "  " }))).toBe("justificativa");
    expect(faltaParaEntrar({ exige: "data_retorno" }, lead({}))).toBe("data_retorno");
    expect(faltaParaEntrar({ exige: "nada" }, lead({}))).toBeNull();
  });
});

describe("prazos", () => {
  it("formata e lê durações", () => {
    expect(formatarDuracao(72)).toBe("3 dias");
    expect(formatarDuracao(48)).toBe("2 dias");
    expect(formatarDuracao(24)).toBe("1 dia");
    expect(formatarDuracao(36)).toBe("36 horas");
    expect(formatarDuracao(null)).toBe("sem limite");
    expect(lerDuracao("3", "dias")).toBe(72);
    expect(lerDuracao("1,5", "dias")).toBe(36);
    expect(lerDuracao("", "sem")).toBeNull();
    expect(lerDuracao("0", "horas")).toBe(false);
    expect(lerDuracao("400", "dias")).toBe(false);
    expect(separarDuracao(72)).toEqual({ valor: "3", unidade: "dias" });
    expect(separarDuracao(36)).toEqual({ valor: "36", unidade: "horas" });
  });
  it("classifica a situação do prazo", () => {
    const agora = Date.parse("2026-11-08T12:00:00Z");
    expect(situacaoPrazo(null, agora)).toBe("sem_prazo");
    expect(situacaoPrazo("2026-11-08T11:00:00Z", agora)).toBe("vencido");
    expect(situacaoPrazo("2026-11-09T06:00:00Z", agora)).toBe("expirando");
    expect(situacaoPrazo("2026-11-11T12:00:00Z", agora)).toBe("ok");
    expect(rotuloPrazo("2026-11-08T17:30:00Z", agora)).toBe("Vence em 6 h");
    expect(rotuloPrazo("2026-11-11T12:00:00Z", agora)).toBe("Vence em 3 dias");
    expect(rotuloPrazo("2026-11-08T11:00:00Z", agora)).toBe("Prazo vencido");
  });
});

describe("contato", () => {
  it("lê o @ colado de várias formas", () => {
    expect(lerHandleLead("@Fulano.Silva")).toBe("fulano.silva");
    expect(lerHandleLead("https://www.instagram.com/fulano_silva/?hl=pt")).toBe("fulano_silva");
    expect(lerHandleLead("nome com espaço")).toBeNull();
  });
  it("monta o link do WhatsApp", () => {
    expect(linkWhatsApp("(11) 99999-0000")).toBe("https://wa.me/5511999990000");
    expect(linkWhatsApp("+55 11 99999-0000")).toBe("https://wa.me/5511999990000");
    expect(linkWhatsApp("1234")).toBeNull();
    expect(linkWhatsApp(null)).toBeNull();
  });
});

describe("filtros e ordem", () => {
  const hojeInicio = Date.parse("2026-11-08T03:00:00Z");
  const lista = [
    lead({ id: 1, handle: "ana.souza", nome: "Ana Souza", responsavel: "eu", prioridade: "alta", criado_em: "2026-11-08T10:00:00Z", expira_em: "2026-11-10T00:00:00Z" }),
    lead({ id: 2, handle: "bruno", responsavel: null, criado_em: "2026-11-03T10:00:00Z", expira_em: "2026-11-09T00:00:00Z" }),
    lead({ id: 3, handle: "carla", responsavel: "outro", prioridade: "baixa", criado_em: "2026-10-01T10:00:00Z" }),
  ];
  it("filtra por busca, responsável, prioridade e período", () => {
    const f = (p: Partial<typeof FILTROS_LEAD_PADRAO>) => filtrarLeads(lista, { ...FILTROS_LEAD_PADRAO, ...p }, { eu: "eu", hojeInicio }).map((l) => l.id);
    expect(f({ busca: "@souza" })).toEqual([1]);
    expect(f({ responsavel: "meus" })).toEqual([1]);
    expect(f({ responsavel: "sem" })).toEqual([2]);
    expect(f({ prioridade: "baixa" })).toEqual([3]);
    expect(f({ periodo: "hoje" })).toEqual([1]);
    expect(f({ periodo: "7d" })).toEqual([1, 2]);
  });
  it("ordena pelo prazo mais próximo", () => {
    expect(ordenarLeads(lista).map((l) => l.id)).toEqual([2, 1, 3]);
  });
});

describe("permissões", () => {
  const vendedor = papelLeads("vendedor", "eu");
  const gestor = papelLeads("estrategista", "g");
  const leitura = papelLeads("leitura", "l");
  it("vendedor mexe só nos próprios; gestão mexe em todos; leitura em nenhum", () => {
    expect(podeMexer({ responsavel: "eu" }, vendedor)).toBe(true);
    expect(podeMexer({ responsavel: "outro" }, vendedor)).toBe(false);
    expect(podeMexer({ responsavel: "outro" }, gestor)).toBe(true);
    expect(podeMexer({ responsavel: "l" }, leitura)).toBe(false);
  });
  it("assume só lead sem dono e que não está desqualificado", () => {
    expect(podeAssumir({ responsavel: null }, { papel: "reservatorio" }, vendedor)).toBe(true);
    expect(podeAssumir({ responsavel: "outro" }, { papel: "trabalho" }, vendedor)).toBe(false);
    expect(podeAssumir({ responsavel: null }, { papel: "terminal" }, vendedor)).toBe(false);
    expect(podeAssumir({ responsavel: null }, { papel: "trabalho" }, leitura)).toBe(false);
  });
});

describe("configuração das colunas", () => {
  const col = (p: Partial<Parameters<typeof papelDaColuna>[0]>) => ({ nome: "A", cor: "#123456", prazo_h: 48, exige: "nada" as const, meta: false, ...p });
  it("aponta problemas como o banco", () => {
    expect(problemasColunas([col({})])).toContain("O funil precisa ter de 2 a 12 colunas.");
    expect(problemasColunas([col({ nome: "A" }), col({ nome: "B", meta: true }), col({ nome: "C", meta: true })])).toContain("Só uma coluna pode ser a meta.");
    expect(problemasColunas([col({ nome: "A", exige: "data_retorno" }), col({ nome: "B" })])).toContain("A primeira coluna não pode pedir data de retorno.");
    expect(problemasColunas([col({ nome: "Base geral" }), col({ nome: "B" })])[0]).toContain("reservado");
    expect(problemasColunas([col({ nome: "A" }), col({ nome: "a" })])[0]).toContain("duas colunas");
    expect(problemasColunas([col({ nome: "A" }), col({ nome: "B" })])).toEqual([]);
  });
  it("dá o papel que o banco vai gravar", () => {
    expect(papelDaColuna(col({ meta: true }), 0)).toBe("entrada");
    expect(papelDaColuna(col({ meta: true }), 2)).toBe("meta");
    expect(papelDaColuna(col({ exige: "data_retorno" }), 3)).toBe("futuro");
    expect(papelDaColuna(col({}), 1)).toBe("trabalho");
  });
});

describe("histórico", () => {
  it("descreve os eventos", () => {
    const base = { id: 1, lead_id: 1, de: null, para: null, detalhe: null, autor_nome: "A", criado_em: "" };
    expect(descreverEventoLead({ ...base, tipo: "etapa", de: "Novo", para: "Qualificado", detalhe: "Quer carta" }, new Map())).toBe("moveu de Novo para Qualificado (motivo: Quer carta)");
    expect(descreverEventoLead({ ...base, tipo: "expirado", de: "Follow-up" }, new Map())).toContain("voltou para a Base Geral");
    expect(descreverEventoLead({ ...base, tipo: "prioridade", de: "normal", para: "alta" }, new Map())).toBe("mudou a prioridade de Normal para Alta");
    expect(descreverEventoLead({ ...base, tipo: "formulario", para: "Simulador", detalhe: "entrou" }, new Map())).toBe('entrou pelo formulário "Simulador"');
  });
});
