// Produtividade da equipe: painel ao vivo (a partir das tarefas) e leitura dos relatórios de formato 2
// (sexta e por período), com comparação e gargalos. Código puro, testado com Vitest.
import { lerRelatorio, type DadosRelatorio } from "@/lib/relatorio";
import { estaAtrasada, STATUS_LABEL, STATUS_ORDEM, type Status, type Tarefa } from "@/lib/tarefas";

export type LinhaResponsavel = { id: string | null; nome: string; ativas: number; atrasadas: number; concluidas: number };

export type ResumoAoVivo = {
  porEtapa: Record<Status, number>;
  ativas: number; // no quadro, sem as arquivadas
  emAndamento: number; // ativas ainda não concluídas
  atrasadas: number;
  concluidas: number;
  agendadas: number;
  publicadas: number;
  porResponsavel: LinhaResponsavel[];
};

export function resumoProducao(tarefas: Tarefa[], hoje: string, membros: { user_id: string; nome: string }[]): ResumoAoVivo {
  const ativas = tarefas.filter((t) => t.arquivada_em === null);
  const porEtapa = Object.fromEntries(STATUS_ORDEM.map((s) => [s, 0])) as Record<Status, number>;
  for (const t of ativas) porEtapa[t.status]++;

  const linha = (id: string | null, nome: string): LinhaResponsavel => {
    const dele = ativas.filter((t) => t.responsavel === id);
    return {
      id,
      nome,
      ativas: dele.length,
      atrasadas: dele.filter((t) => estaAtrasada(t, hoje)).length,
      concluidas: dele.filter((t) => t.concluida_em !== null).length,
    };
  };
  const conhecidos = new Set(membros.map((m) => m.user_id));
  const porResponsavel = [
    ...membros.map((m) => linha(m.user_id, m.nome)),
    linha(null, "Sem responsável"),
    // Tarefa de quem saiu do ambiente aparece como pessoa removida (o banco já zera o responsável; isto é só proteção).
    ...[...new Set(ativas.map((t) => t.responsavel).filter((r): r is string => !!r && !conhecidos.has(r)))].map((r) => linha(r, "Pessoa removida")),
  ].filter((l) => l.ativas > 0 || l.id !== null);

  return {
    porEtapa,
    ativas: ativas.length,
    emAndamento: ativas.filter((t) => t.concluida_em === null).length,
    atrasadas: ativas.filter((t) => estaAtrasada(t, hoje)).length,
    concluidas: ativas.filter((t) => t.concluida_em !== null).length,
    agendadas: porEtapa.agendado,
    publicadas: porEtapa.publicado,
    porResponsavel,
  };
}

// ─── Relatório de formato 2 ───
export type ResponsavelRel = {
  id: string | null;
  nome: string;
  criadas: number;
  concluidas: number;
  movimentacoes: number;
  acoes: number;
  pendentes: number;
  atrasadas: number;
};
export type PerfilProducaoRel = { id: number | null; handle: string | null; criadas: number; concluidas: number; publicadas: number; pendentes: number; atrasadas: number };
export type ProducaoRel = {
  criadas: number;
  concluidas: number;
  movimentacoes: number;
  publicadas: number;
  arquivadas: number;
  atrasadas_agora: number;
  pendentes_agora: number;
  movimentos_por_etapa: Partial<Record<Status, number>>;
  etapas_agora: Partial<Record<Status, number>>;
  por_responsavel: ResponsavelRel[];
  por_perfil: PerfilProducaoRel[]; // só no relatório do grupo (relatórios antigos vêm vazios)
};
export type PerfilV2 = DadosRelatorio["perfis"][number] & { likes: number | null; comentarios: number | null; views: number | null };
export type EscopoRel = { tipo: "grupo" } | { tipo: "perfil"; handle: string };
export type RelatorioV2 = {
  escopo: EscopoRel;
  producao: ProducaoRel;
  instagram: { perfis: PerfilV2[]; top_posts: (DadosRelatorio["top_posts"][number] & { views: number | null })[]; indisponiveis: string[] };
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const contagem = (v: unknown): Partial<Record<Status, number>> => {
  const r: Partial<Record<Status, number>> = {};
  for (const [k, n] of Object.entries(obj(v))) if ((STATUS_ORDEM as string[]).includes(k) && num(n) !== null) r[k as Status] = num(n)!;
  return r;
};

export function ehFormato2(dados: unknown): boolean {
  return obj(dados).formato === 2;
}

// Lê o jsonb do relatório novo. Valores ausentes viram 0/null em vez de quebrar a tela.
export function lerRelatorioV2(dados: unknown): RelatorioV2 {
  const d = obj(dados);
  const p = obj(d.producao);
  const ig = obj(d.instagram);
  const base = lerRelatorio(ig);
  const perfisBrutos = Array.isArray(ig.perfis) ? (ig.perfis as unknown[]).map(obj) : [];
  const postsBrutos = Array.isArray(ig.top_posts) ? (ig.top_posts as unknown[]).map(obj) : [];
  const esc = obj(d.escopo);
  return {
    escopo: esc.tipo === "perfil" && typeof esc.handle === "string" ? { tipo: "perfil", handle: esc.handle } : { tipo: "grupo" },
    producao: {
      criadas: num(p.criadas) ?? 0,
      concluidas: num(p.concluidas) ?? 0,
      movimentacoes: num(p.movimentacoes) ?? 0,
      publicadas: num(p.publicadas) ?? 0,
      arquivadas: num(p.arquivadas) ?? 0,
      atrasadas_agora: num(p.atrasadas_agora) ?? 0,
      pendentes_agora: num(p.pendentes_agora) ?? 0,
      movimentos_por_etapa: contagem(p.movimentos_por_etapa),
      etapas_agora: contagem(p.etapas_agora),
      por_responsavel: (Array.isArray(p.por_responsavel) ? (p.por_responsavel as unknown[]) : []).map(obj).map((r) => ({
        id: typeof r.id === "string" ? r.id : null,
        nome: typeof r.nome === "string" ? r.nome : "Sem nome",
        criadas: num(r.criadas) ?? 0,
        concluidas: num(r.concluidas) ?? 0,
        movimentacoes: num(r.movimentacoes) ?? 0,
        acoes: num(r.acoes) ?? 0,
        pendentes: num(r.pendentes) ?? 0,
        atrasadas: num(r.atrasadas) ?? 0,
      })),
      por_perfil: (Array.isArray(p.por_perfil) ? (p.por_perfil as unknown[]) : []).map(obj).map((r) => ({
        id: num(r.id),
        handle: typeof r.handle === "string" ? r.handle : null,
        criadas: num(r.criadas) ?? 0,
        concluidas: num(r.concluidas) ?? 0,
        publicadas: num(r.publicadas) ?? 0,
        pendentes: num(r.pendentes) ?? 0,
        atrasadas: num(r.atrasadas) ?? 0,
      })),
    },
    instagram: {
      perfis: base.perfis.map((pf) => {
        const b = perfisBrutos.find((x) => num(x.id) === pf.id) ?? {};
        return { ...pf, likes: num(b.likes), comentarios: num(b.comentarios), views: num(b.views) };
      }),
      top_posts: base.top_posts.map((tp) => ({ ...tp, views: num(postsBrutos.find((x) => x.id === tp.id)?.views) })),
      indisponiveis: Array.isArray(ig.indisponiveis) ? (ig.indisponiveis as unknown[]).filter((x): x is string => typeof x === "string") : [],
    },
  };
}

const ROTULO_METRICA: Record<string, string> = { alcance: "alcance", compartilhamentos: "compartilhamentos", salvamentos: "salvamentos" };
export function rotuloIndisponiveis(lista: string[]): string {
  return lista.map((m) => ROTULO_METRICA[m] ?? m).join(", ");
}

// Gargalos: só aponta o que os números sustentam.
export function gargalos(p: ProducaoRel): string[] {
  const frases: string[] = [];
  const emProducao = (["roteirizacao", "gravacao", "edicao", "pronto"] as Status[])
    .map((s) => ({ s, n: p.etapas_agora[s] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const total = emProducao.reduce((s, x) => s + x.n, 0);
  if (total >= 3 && emProducao[0].n / total >= 0.4) {
    frases.push(`${emProducao[0].n} de ${total} tarefas em produção estão paradas em ${STATUS_LABEL[emProducao[0].s]}.`);
  }
  if (p.atrasadas_agora > 0) {
    const pior = [...p.por_responsavel].sort((a, b) => b.atrasadas - a.atrasadas)[0];
    frases.push(
      `${p.atrasadas_agora} ${p.atrasadas_agora === 1 ? "tarefa atrasada" : "tarefas atrasadas"} agora` +
        (pior && pior.atrasadas > 0 ? `, ${pior.atrasadas} com ${pior.id ? pior.nome : "nenhum responsável"}.` : "."),
    );
  }
  if (p.criadas > 0 && p.concluidas === 0) frases.push("Entraram tarefas novas no período, mas nenhuma foi concluída.");
  if ((p.etapas_agora.pronto ?? 0) > 0 && p.publicadas === 0) frases.push(`${p.etapas_agora.pronto} prontas para postar e nenhuma publicação no período.`);
  return frases;
}

export type Comparacao = { rotulo: string; atual: number; anterior: number | null; maiorMelhor: boolean };

export function comparar(atual: ProducaoRel, anterior: ProducaoRel | null): Comparacao[] {
  const linha = (rotulo: string, k: keyof ProducaoRel, maiorMelhor = true): Comparacao => ({
    rotulo,
    atual: atual[k] as number,
    anterior: anterior ? (anterior[k] as number) : null,
    maiorMelhor,
  });
  return [
    linha("Tarefas criadas", "criadas"),
    linha("Tarefas concluídas", "concluidas"),
    linha("Publicadas", "publicadas"),
    linha("Movimentações entre etapas", "movimentacoes"),
    linha("Atrasadas no fechamento", "atrasadas_agora", false),
  ];
}
