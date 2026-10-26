// Regras do Planejador (Kanban de produção): colunas, status, atraso, filtros e ordenação.
// Código puro, sem Supabase, testado com Vitest.

export type Status = "roteirizacao" | "gravacao" | "edicao" | "pronto" | "agendado" | "publicado";
export type ColunaId = "roteirizacao" | "gravacao" | "edicao" | "pronto" | "final";

export const STATUS_LABEL: Record<Status, string> = {
  roteirizacao: "Roteirização",
  gravacao: "Em gravação",
  edicao: "Edição / Design",
  pronto: "Pronto para postar",
  agendado: "Agendado",
  publicado: "Publicado",
};
export const STATUS_ORDEM: Status[] = ["roteirizacao", "gravacao", "edicao", "pronto", "agendado", "publicado"];

export const COLUNAS: { id: ColunaId; titulo: string }[] = [
  { id: "roteirizacao", titulo: "Roteirização" },
  { id: "gravacao", titulo: "Em gravação" },
  { id: "edicao", titulo: "Edição / Design" },
  { id: "pronto", titulo: "Pronto para postar" },
  { id: "final", titulo: "Agendado / Publicado" },
];

export type Tarefa = {
  id: number;
  conta_id: number;
  titulo: string;
  status: Status;
  responsavel: string | null;
  vencimento: string | null; // AAAA-MM-DD
  link_roteiro: string | null;
  link_drive: string | null;
  data_publicacao: string | null; // AAAA-MM-DD
  ordem: number;
  concluida_em: string | null;
  publicado_em: string | null;
  arquivada_em: string | null;
  arquivada_auto: boolean;
  restaurada_em: string | null;
  criado_em: string;
  criado_por: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
};

export const CAMPOS_TAREFA =
  "id, conta_id, titulo, status, responsavel, vencimento, link_roteiro, link_drive, data_publicacao, ordem, concluida_em, publicado_em, arquivada_em, arquivada_auto, restaurada_em, criado_em, criado_por, atualizado_em, atualizado_por";

export function colunaDe(status: Status): ColunaId {
  return status === "agendado" || status === "publicado" ? "final" : status;
}

// Status ao soltar um cartão numa coluna. Na última coluna, quem já era agendado/publicado continua igual;
// quem chega de outra etapa entra como "agendado" (publicar é uma ação explícita).
export function statusAoSoltar(coluna: ColunaId, atual: Status): Status {
  if (coluna !== "final") return coluna;
  return atual === "agendado" || atual === "publicado" ? atual : "agendado";
}

export function estaConcluida(t: Pick<Tarefa, "concluida_em">): boolean {
  return t.concluida_em !== null;
}

// Atrasada: tem data da tarefa, ela já passou (no dia local) e a tarefa não foi concluída nem arquivada.
export function estaAtrasada(t: Pick<Tarefa, "vencimento" | "concluida_em" | "arquivada_em">, hoje: string): boolean {
  return t.vencimento !== null && t.concluida_em === null && t.arquivada_em === null && t.vencimento < hoje;
}

// Data de hoje (AAAA-MM-DD) no fuso do ambiente.
export function hojeNoFuso(fuso = "America/Sao_Paulo", agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

// Link opcional: vazio vira null; aceita só http/https. false = inválido.
export function lerLink(v: unknown): string | null | false {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && !/\s/.test(s) ? s : false;
  } catch {
    return false;
  }
}

export function lerData(v: unknown): string | null | false {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? false : s;
}

export type Filtros = {
  busca: string;
  responsavel: string; // "todos" | "sem" | user_id
  status: Status | "todos";
  atrasadas: boolean;
  de: string; // AAAA-MM-DD ou ""
  ate: string;
};
export const FILTROS_PADRAO: Filtros = { busca: "", responsavel: "todos", status: "todos", atrasadas: false, de: "", ate: "" };

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Período: vale a data da tarefa ou a data de publicação dentro do intervalo.
function noPeriodo(t: Pick<Tarefa, "vencimento" | "data_publicacao">, de: string, ate: string): boolean {
  if (!de && !ate) return true;
  return [t.vencimento, t.data_publicacao].some((d) => d !== null && (!de || d >= de) && (!ate || d <= ate));
}

export function filtrar<T extends Tarefa>(tarefas: T[], f: Filtros, hoje: string): T[] {
  const termo = normalizar(f.busca.trim());
  return tarefas.filter(
    (t) =>
      (!termo || normalizar(t.titulo).includes(termo)) &&
      (f.responsavel === "todos" || (f.responsavel === "sem" ? t.responsavel === null : t.responsavel === f.responsavel)) &&
      (f.status === "todos" || t.status === f.status) &&
      (!f.atrasadas || estaAtrasada(t, hoje)) &&
      noPeriodo(t, f.de, f.ate),
  );
}

export type Ordenacao = "manual" | "vencimento" | "criacao";

export function ordenar<T extends Tarefa>(tarefas: T[], modo: Ordenacao): T[] {
  const copia = [...tarefas];
  if (modo === "vencimento") {
    // Sem data vai para o fim; empate segue a ordem manual.
    return copia.sort((a, b) => (a.vencimento ?? "9999").localeCompare(b.vencimento ?? "9999") || a.ordem - b.ordem);
  }
  if (modo === "criacao") return copia.sort((a, b) => b.criado_em.localeCompare(a.criado_em) || b.id - a.id);
  return copia.sort((a, b) => a.ordem - b.ordem || a.id - b.id);
}

// Posição entre dois vizinhos ao soltar um cartão (ordem crescente dentro da coluna).
export function ordemEntre(antes: number | undefined, depois: number | undefined, agora = Date.now() / 1000): number {
  if (antes === undefined && depois === undefined) return agora;
  if (antes === undefined) return (depois as number) - 1;
  if (depois === undefined) return antes + 1;
  return (antes + depois) / 2;
}

// Cópia de uma tarefa: mesmos dados de trabalho, sem comentários, histórico ou conclusão.
export function dadosDuplicados(t: Tarefa) {
  const status: Status = t.status === "publicado" ? "agendado" : t.status;
  return {
    titulo: `${t.titulo} (cópia)`.slice(0, 200),
    status,
    responsavel: t.responsavel,
    vencimento: t.vencimento,
    link_roteiro: t.link_roteiro,
    link_drive: t.link_drive,
    data_publicacao: t.data_publicacao,
    ordem: t.ordem + 0.001,
  };
}

// Concluir pelo atalho: na última coluna, concluir é publicar; nas demais, marca como concluída.
export function mudancaConcluir(t: Pick<Tarefa, "status">, agoraIso: string): Partial<Tarefa> {
  if (t.status === "agendado") return { status: "publicado" };
  return { concluida_em: agoraIso };
}

// Reabrir: tira a conclusão. Publicado volta para Agendado (só "publicado" conta como concluído).
export function mudancaReabrir(t: Pick<Tarefa, "status">): Partial<Tarefa> {
  return t.status === "publicado" ? { status: "agendado", concluida_em: null } : { concluida_em: null };
}

export type Evento = {
  id: number;
  tarefa_id: number;
  tipo: "criada" | "status" | "concluida" | "reaberta" | "arquivada" | "restaurada" | "responsavel" | "renomeada";
  de: string | null;
  para: string | null;
  autor_nome: string;
  criado_em: string;
};

export function descreverEvento(e: Evento, nomes: Map<string, string>): string {
  const pessoa = (id: string | null) => (id ? (nomes.get(id) ?? "pessoa removida") : "ninguém");
  const st = (s: string | null) => (s && s in STATUS_LABEL ? STATUS_LABEL[s as Status] : (s ?? ""));
  switch (e.tipo) {
    case "criada":
      return `criou a tarefa em ${st(e.para)}`;
    case "status":
      return `moveu de ${st(e.de)} para ${st(e.para)}`;
    case "concluida":
      return "concluiu a tarefa";
    case "reaberta":
      return "reabriu a tarefa";
    case "arquivada":
      return e.para === "automatico" ? "arquivou automaticamente (7 dias após a publicação)" : "arquivou a tarefa";
    case "restaurada":
      return "restaurou a tarefa";
    case "responsavel":
      return `trocou o responsável de ${pessoa(e.de)} para ${pessoa(e.para)}`;
    case "renomeada":
      return `renomeou de "${e.de ?? ""}" para "${e.para ?? ""}"`;
  }
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
export function dataCurta(d: string | null): string {
  return d ? fmtData.format(new Date(`${d}T12:00:00Z`)).replace(" de ", " ").replace(".", "") : "";
}
