import { describe, expect, it } from "vitest";
import { comparar, ehFormato2, gargalos, lerRelatorioV2, resumoProducao, rotuloIndisponiveis } from "./producao";
import type { Tarefa } from "./tarefas";

const base: Tarefa = {
  id: 1, conta_id: 1, titulo: "x", status: "roteirizacao", responsavel: null, vencimento: null, link_roteiro: null, link_drive: null,
  data_publicacao: null, ordem: 1, concluida_em: null, publicado_em: null, arquivada_em: null, arquivada_auto: false, restaurada_em: null,
  criado_em: "2026-10-20T00:00:00Z", criado_por: null, atualizado_em: "2026-10-20T00:00:00Z", atualizado_por: null,
};
const t = (x: Partial<Tarefa>): Tarefa => ({ ...base, ...x });

describe("resumoProducao", () => {
  const membros = [{ user_id: "a", nome: "Ana" }, { user_id: "b", nome: "Bia" }];
  const r = resumoProducao(
    [
      t({ id: 1, responsavel: "a", vencimento: "2026-10-20" }),
      t({ id: 2, responsavel: "a", status: "agendado" }),
      t({ id: 3, status: "publicado", concluida_em: "x" }),
      t({ id: 4, status: "edicao", arquivada_em: "x" }),
    ],
    "2026-10-26",
    membros,
  );
  it("conta etapas e totais só do quadro (sem arquivadas)", () => {
    expect(r.ativas).toBe(3);
    expect(r.porEtapa.edicao).toBe(0);
    expect(r.atrasadas).toBe(1);
    expect(r.concluidas).toBe(1);
    expect(r.agendadas).toBe(1);
    expect(r.publicadas).toBe(1);
    expect(r.emAndamento).toBe(2);
  });
  it("separa por responsável, inclusive quem não tem tarefa", () => {
    expect(r.porResponsavel.find((l) => l.id === "a")).toMatchObject({ ativas: 2, atrasadas: 1 });
    expect(r.porResponsavel.find((l) => l.id === "b")).toMatchObject({ ativas: 0 });
    expect(r.porResponsavel.find((l) => l.id === null)).toMatchObject({ ativas: 1, concluidas: 1 });
  });
});

describe("relatório de formato 2", () => {
  const dados = {
    formato: 2,
    producao: {
      criadas: 4, concluidas: 0, movimentacoes: 6, publicadas: 0, arquivadas: 1, atrasadas_agora: 2, pendentes_agora: 5,
      movimentos_por_etapa: { edicao: 3, inventada: 9 },
      etapas_agora: { roteirizacao: 1, edicao: 4, pronto: 2 },
      por_responsavel: [{ id: "a", nome: "Ana", atrasadas: 2, concluidas: 0 }, { id: null, nome: "Sem responsável", atrasadas: 0 }],
    },
    instagram: {
      perfis: [{ id: 7, handle: "prefiro", grupo: "proprio", seguidores_inicio: 100, seguidores_fim: 110, dias_coletados: 7, posts: 2, interacoes: 30, likes: 25, comentarios: 5, views: null }],
      top_posts: [{ id: "7_1", handle: "prefiro", interacoes: 20, views: 900 }],
      indisponiveis: ["alcance", "salvamentos"],
    },
  };
  const r = lerRelatorioV2(dados);
  it("reconhece o formato e lê produção e Instagram", () => {
    expect(ehFormato2(dados)).toBe(true);
    expect(ehFormato2({ perfis: [] })).toBe(false);
    expect(r.producao.movimentos_por_etapa).toEqual({ edicao: 3 });
    expect(r.instagram.perfis[0]).toMatchObject({ handle: "prefiro", likes: 25, views: null });
    expect(r.instagram.top_posts[0].views).toBe(900);
    expect(rotuloIndisponiveis(r.instagram.indisponiveis)).toBe("alcance, salvamentos");
  });
  it("aponta gargalos sustentados pelos números", () => {
    const g = gargalos(r.producao);
    expect(g[0]).toContain("Edição / Design");
    expect(g.some((f) => f.includes("2 tarefas atrasadas") && f.includes("Ana"))).toBe(true);
    expect(g).toContain("Entraram tarefas novas no período, mas nenhuma foi concluída.");
    expect(g.some((f) => f.includes("prontas para postar"))).toBe(true);
  });
  it("compara com o relatório anterior", () => {
    const c = comparar(r.producao, { ...r.producao, criadas: 1 });
    expect(c[0]).toEqual({ rotulo: "Tarefas criadas", atual: 4, anterior: 1, maiorMelhor: true });
    expect(comparar(r.producao, null)[0].anterior).toBeNull();
  });
});
