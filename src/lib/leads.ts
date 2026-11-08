// Leads (Social Selling): tipos, colunas do quadro, prazos, filtros, permissões e links de contato.
// Código puro, sem Supabase, testado com Vitest. O banco é a autoridade: aqui só se espelham as regras
// para a tela avisar antes de salvar.
import { normalizarHandle } from "@/lib/perfis";

export type PapelEtapa = "entrada" | "trabalho" | "meta" | "futuro" | "reservatorio" | "terminal";
export type Exige = "nada" | "justificativa" | "contato" | "data_retorno";
export type Prioridade = "baixa" | "normal" | "alta";

export type Pipeline = { id: number; nome: string; tipo: "social" | "personalizado"; expira_para_base: boolean; vida_max_h: number | null };
export type Etapa = { id: number; pipeline_id: number; nome: string; cor: string; posicao: number; papel: PapelEtapa; prazo_h: number | null; exige: Exige };

export type Lead = {
  id: number;
  conta_id: number;
  pipeline_id: number;
  etapa_id: number;
  perfil_id: number | null;
  handle: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  prioridade: Prioridade;
  observacao: string | null;
  tags: string[];
  responsavel: string | null;
  assumido_em: string | null;
  justificativa: string | null;
  data_retorno: string | null; // AAAA-MM-DD
  etapa_desde: string;
  funil_desde: string;
  expira_em: string | null;
  expirado_em: string | null;
  criado_em: string;
  criado_por: string | null;
  atualizado_em: string;
};

export const CAMPOS_LEAD =
  "id, conta_id, pipeline_id, etapa_id, perfil_id, handle, nome, telefone, email, prioridade, observacao, tags, responsavel, assumido_em, justificativa, data_retorno, etapa_desde, funil_desde, expira_em, expirado_em, criado_em, criado_por, atualizado_em";
export const CAMPOS_ETAPA = "id, pipeline_id, nome, cor, posicao, papel, prazo_h, exige";
export const CAMPOS_PIPELINE = "id, nome, tipo, expira_para_base, vida_max_h";

export const PRIORIDADE_LABEL: Record<Prioridade, string> = { alta: "Alta", normal: "Normal", baixa: "Baixa" };
export const EXIGE_LABEL: Record<Exige, string> = {
  nada: "Nada",
  justificativa: "Um motivo escrito (justificativa)",
  contato: "Telefone e e-mail do lead",
  data_retorno: "Uma data para retomar o contato",
};

// ─── Etapas ──────────────────────────────────────────────────────────────────
const porPosicao = (a: Etapa, b: Etapa) => a.posicao - b.posicao || a.id - b.id;

// Colunas do quadro: tudo menos Base Geral e Desqualificado, na ordem.
export function colunasDoQuadro(etapas: Etapa[]): Etapa[] {
  return etapas.filter((e) => e.papel !== "reservatorio" && e.papel !== "terminal").sort(porPosicao);
}

export function etapaDoPapel(etapas: Etapa[], papel: PapelEtapa): Etapa | null {
  return [...etapas].sort(porPosicao).find((e) => e.papel === papel) ?? null;
}

// Follow-up: a primeira coluna de trabalho depois da entrada.
export function etapaFollowUp(etapas: Etapa[]): Etapa | null {
  return colunasDoQuadro(etapas).find((e) => e.papel === "trabalho") ?? null;
}

export type Falta = "justificativa" | "contato" | "data_retorno";

// O que falta ao lead para entrar na etapa (null = pode entrar já).
export function faltaParaEntrar(etapa: Pick<Etapa, "exige">, lead: Pick<Lead, "justificativa" | "telefone" | "email" | "data_retorno">): Falta | null {
  const vazio = (v: string | null) => !v || !v.trim();
  if (etapa.exige === "justificativa" && vazio(lead.justificativa)) return "justificativa";
  if (etapa.exige === "contato" && (vazio(lead.telefone) || vazio(lead.email))) return "contato";
  if (etapa.exige === "data_retorno" && vazio(lead.data_retorno)) return "data_retorno";
  return null;
}

// ─── Prazos ──────────────────────────────────────────────────────────────────
const HORA = 3_600_000;

export function formatarDuracao(h: number | null): string {
  if (h === null) return "sem limite";
  if (h >= 48 && h % 24 === 0) return `${h / 24} dias`;
  if (h === 24) return "1 dia";
  return h === 1 ? "1 hora" : `${h} horas`;
}

// Converte o campo da tela (valor + unidade) em horas. null = sem limite; NaN/fora do intervalo = inválido (false).
export function lerDuracao(valor: string, unidade: "horas" | "dias" | "sem"): number | null | false {
  if (unidade === "sem") return null;
  const n = Number(valor.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return false;
  const h = Math.round(unidade === "dias" ? n * 24 : n);
  return h >= 1 && h <= 8760 ? h : false;
}

export function separarDuracao(h: number | null): { valor: string; unidade: "horas" | "dias" | "sem" } {
  if (h === null) return { valor: "", unidade: "sem" };
  return h % 24 === 0 ? { valor: String(h / 24), unidade: "dias" } : { valor: String(h), unidade: "horas" };
}

export type SituacaoPrazo = "sem_prazo" | "ok" | "expirando" | "vencido";

// Expirando = vence em até 24 horas.
export function situacaoPrazo(expiraEm: string | null, agora: number): SituacaoPrazo {
  if (!expiraEm) return "sem_prazo";
  const resta = Date.parse(expiraEm) - agora;
  if (resta <= 0) return "vencido";
  return resta <= 24 * HORA ? "expirando" : "ok";
}

export function rotuloPrazo(expiraEm: string | null, agora: number): string {
  if (!expiraEm) return "Sem prazo";
  const resta = Date.parse(expiraEm) - agora;
  if (resta <= 0) return "Prazo vencido";
  const h = Math.ceil(resta / HORA);
  if (h < 24) return `Vence em ${h} h`;
  const d = Math.round(h / 24);
  return `Vence em ${d} ${d === 1 ? "dia" : "dias"}`;
}

// ─── Entrada ─────────────────────────────────────────────────────────────────
// "Colar lead": aceita @handle, handle ou link do Instagram.
export function lerHandleLead(entrada: string): string | null {
  return normalizarHandle(entrada);
}

export function linkInstagram(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}

// WhatsApp: só dígitos; número brasileiro sem DDI (10 ou 11 dígitos) ganha o 55.
export function linkWhatsApp(telefone: string | null): string | null {
  const d = (telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}`;
  if (d.length >= 12 && d.length <= 15) return `https://wa.me/${d}`;
  return null;
}

export function validarEmailLead(v: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
}

// ─── Filtros ─────────────────────────────────────────────────────────────────
export type FiltrosLead = {
  busca: string;
  responsavel: "todos" | "meus" | "sem" | string;
  prioridade: Prioridade | "todas";
  periodo: "todos" | "hoje" | "7d" | "30d";
};
export const FILTROS_LEAD_PADRAO: FiltrosLead = { busca: "", responsavel: "todos", prioridade: "todas", periodo: "todos" };

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// periodo usa a data de entrada (criado_em). hojeInicio = início do dia local em ms.
export function filtrarLeads<T extends Lead>(leads: T[], f: FiltrosLead, ctx: { eu: string; hojeInicio: number }): T[] {
  const termo = normalizar(f.busca.trim().replace(/^@/, ""));
  const desde =
    f.periodo === "hoje" ? ctx.hojeInicio : f.periodo === "7d" ? ctx.hojeInicio - 6 * 24 * HORA : f.periodo === "30d" ? ctx.hojeInicio - 29 * 24 * HORA : null;
  return leads.filter(
    (l) =>
      (!termo || normalizar(l.handle).includes(termo) || normalizar(l.nome ?? "").includes(termo)) &&
      (f.responsavel === "todos" ||
        (f.responsavel === "meus" ? l.responsavel === ctx.eu : f.responsavel === "sem" ? l.responsavel === null : l.responsavel === f.responsavel)) &&
      (f.prioridade === "todas" || l.prioridade === f.prioridade) &&
      (desde === null || Date.parse(l.criado_em) >= desde),
  );
}

const PESO_PRIORIDADE: Record<Prioridade, number> = { alta: 0, normal: 1, baixa: 2 };

// Dentro da coluna: o que vence primeiro em cima; depois prioridade; depois o mais antigo.
export function ordenarLeads<T extends Lead>(leads: T[]): T[] {
  return [...leads].sort(
    (a, b) =>
      (a.expira_em ? Date.parse(a.expira_em) : Infinity) - (b.expira_em ? Date.parse(b.expira_em) : Infinity) ||
      PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade] ||
      a.criado_em.localeCompare(b.criado_em),
  );
}

// ─── Permissões (espelham o RLS) ─────────────────────────────────────────────
export type PermissaoLeads = { eu: string; trabalha: boolean; gestor: boolean; admin: boolean };

export function papelLeads(papel: string | null | undefined, eu: string): PermissaoLeads {
  const p = papel ?? "";
  return {
    eu,
    trabalha: ["admin", "estrategista", "criador", "vendedor"].includes(p),
    gestor: ["admin", "estrategista"].includes(p),
    admin: p === "admin",
  };
}

// Mexer no lead: o responsável (com papel de trabalho) ou a gestão.
export function podeMexer(lead: Pick<Lead, "responsavel">, p: PermissaoLeads): boolean {
  return p.gestor || (p.trabalha && lead.responsavel === p.eu);
}

export function podeAssumir(lead: Pick<Lead, "responsavel">, etapa: Pick<Etapa, "papel"> | null, p: PermissaoLeads): boolean {
  return p.trabalha && lead.responsavel === null && !!etapa && etapa.papel !== "terminal";
}

// ─── Configuração das colunas (espelho de hub.salvar_etapas) ─────────────────
export type ColunaRascunho = { id?: number; nome: string; cor: string; prazo_h: number | null; exige: Exige; meta: boolean };
const RESERVADOS = ["base geral", "desqualificado"];

export function problemasColunas(cols: ColunaRascunho[]): string[] {
  const p: string[] = [];
  if (cols.length < 2 || cols.length > 12) p.push("O funil precisa ter de 2 a 12 colunas.");
  if (cols.filter((c) => c.meta).length > 1) p.push("Só uma coluna pode ser a meta.");
  if (cols[0]?.exige === "data_retorno") p.push("A primeira coluna não pode pedir data de retorno.");
  const vistos = new Set<string>();
  cols.forEach((c, i) => {
    const nome = c.nome.trim();
    const chave = normalizar(nome);
    if (!nome || nome.length > 40) p.push(`Dê um nome de até 40 caracteres à coluna ${i + 1}.`);
    else if (RESERVADOS.includes(chave)) p.push(`"${nome}" é um nome reservado.`);
    else if (vistos.has(chave)) p.push(`Há duas colunas chamadas "${nome}".`);
    vistos.add(chave);
    if (c.prazo_h !== null && (c.prazo_h < 1 || c.prazo_h > 8760)) p.push(`O prazo da coluna ${i + 1} precisa ficar entre 1 hora e 365 dias.`);
    if (!/^#[0-9a-fA-F]{6}$/.test(c.cor)) p.push(`Cor inválida na coluna ${i + 1}.`);
  });
  return p;
}

// Papel que o banco vai dar a cada coluna ao salvar.
export function papelDaColuna(c: ColunaRascunho, indice: number): PapelEtapa {
  if (indice === 0) return "entrada";
  if (c.meta) return "meta";
  return c.exige === "data_retorno" ? "futuro" : "trabalho";
}

// ─── Histórico ───────────────────────────────────────────────────────────────
export type EventoLead = {
  id: number;
  lead_id: number;
  tipo: "criado" | "etapa" | "assumido" | "responsavel" | "expirado" | "perfil" | "prioridade" | "formulario";
  de: string | null;
  para: string | null;
  detalhe: string | null;
  autor_nome: string;
  criado_em: string;
};

export function descreverEventoLead(e: EventoLead, nomes: Map<string, string>): string {
  const pessoa = (id: string | null) => (id ? (nomes.get(id) ?? "pessoa removida") : "ninguém");
  switch (e.tipo) {
    case "criado":
      return `cadastrou o lead em ${e.para ?? "?"}`;
    case "etapa":
      return `moveu de ${e.de ?? "?"} para ${e.para ?? "?"}${e.detalhe ? ` (motivo: ${e.detalhe})` : ""}`;
    case "expirado":
      return `prazo de ${e.de ?? "?"} venceu: voltou para a Base Geral sem responsável`;
    case "assumido":
      return "assumiu o lead";
    case "responsavel":
      return `trocou o responsável de ${pessoa(e.de)} para ${pessoa(e.para)}`;
    case "perfil":
      return `trocou o perfil de ${e.de ? "@" + e.de : "nenhum"} para ${e.para ? "@" + e.para : "nenhum"}`;
    case "formulario":
      return e.detalhe === "entrou" ? `entrou pelo formulário "${e.para ?? "?"}"` : `respondeu o formulário "${e.para ?? "?"}"`;
    case "prioridade":
      return `mudou a prioridade de ${PRIORIDADE_LABEL[e.de as Prioridade] ?? e.de} para ${PRIORIDADE_LABEL[e.para as Prioridade] ?? e.para}`;
  }
}
