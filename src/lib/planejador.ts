// Regras do planejador, calendário e briefings. Funções puras, sem rede.

export const COLUNAS = [
  { id: "garagem", rotulo: "Ideias", dica: "Ainda não começou" },
  { id: "pista", rotulo: "Em produção", dica: "Gravando ou editando" },
  { id: "chegada", rotulo: "Publicado", dica: "Já está no ar" },
] as const;
export type Coluna = (typeof COLUNAS)[number]["id"];

export const FORMATOS = ["Reel", "Carrossel", "Foto", "Story", "Live", "Vídeo longo"] as const;

export const AMBIENTES = {
  casa: "Casa",
  escritorio: "Escritório",
  rua: "Externa",
  livre: "Sem câmera (texto ou narração)",
} as const;
export type Ambiente = keyof typeof AMBIENTES;

export const STATUS_PRODUCAO = {
  a_gravar: "A gravar",
  gravado: "Gravado",
  aguardando_edicao: "Aguardando edição",
  em_edicao: "Em edição",
  editado: "Editado",
  aguardando_postagem: "Aguardando postagem",
  postado: "Postado",
} as const;
export type StatusProducao = keyof typeof STATUS_PRODUCAO;

export type Ideia = {
  id: number;
  perfil_id: number;
  titulo: string;
  gancho: string | null;
  tese: string | null;
  cta: string | null;
  formato: string | null;
  pilar: string | null;
  ambiente: Ambiente | null;
  coluna: Coluna;
  status_producao: StatusProducao | null;
  ordem: number;
  publicar_em: string | null;
  referencias: string[];
  post_id: string | null;
};

export function isColuna(v: unknown): v is Coluna {
  return v === "garagem" || v === "pista" || v === "chegada";
}

export function colunaSeguinte(c: Coluna): Coluna | null {
  return c === "garagem" ? "pista" : c === "pista" ? "chegada" : null;
}
export function colunaAnterior(c: Coluna): Coluna | null {
  return c === "chegada" ? "pista" : c === "pista" ? "garagem" : null;
}

// ─── Datas no fuso de São Paulo (UTC−3, sem horário de verão desde 2019) ───
const FUSO = "America/Sao_Paulo";

export function paraTimestampSP(data: string, hora: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const h = /^\d{2}:\d{2}$/.test(hora) ? hora : "09:00";
  const d = new Date(`${data}T${h}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function partesSP(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { data, hora };
}

// ─── Formulário de ideia ───
export type DadosIdeia = Omit<Ideia, "id" | "ordem">;

function texto(fd: FormData, campo: string, max: number): string | null {
  const v = String(fd.get(campo) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

export function lerFormIdeia(fd: FormData): { erro: string } | { dados: DadosIdeia } {
  const titulo = texto(fd, "titulo", 200);
  if (!titulo) return { erro: "Dê um título para a ideia." };

  const perfilId = Number(fd.get("perfil_id"));
  if (!Number.isInteger(perfilId) || perfilId <= 0) return { erro: "Escolha o perfil." };

  const coluna = fd.get("coluna");
  if (!isColuna(coluna)) return { erro: "Coluna inválida." };

  const ambiente = String(fd.get("ambiente") ?? "");
  const status = String(fd.get("status_producao") ?? "");

  const refs = String(fd.get("referencias") ?? "")
    .split(/\s+/)
    .map((r) => r.trim())
    .filter(Boolean);
  const invalida = refs.find((r) => !/^https?:\/\/\S+$/i.test(r));
  if (invalida) return { erro: `Referência não é um link válido: ${invalida}` };

  const data = String(fd.get("data") ?? "");
  const publicar_em = data ? paraTimestampSP(data, String(fd.get("hora") ?? "")) : null;
  if (data && !publicar_em) return { erro: "Data de postagem inválida." };

  return {
    dados: {
      perfil_id: perfilId,
      titulo,
      gancho: texto(fd, "gancho", 500),
      tese: texto(fd, "tese", 2000),
      cta: texto(fd, "cta", 300),
      formato: texto(fd, "formato", 40),
      pilar: texto(fd, "pilar", 60),
      ambiente: Object.hasOwn(AMBIENTES, ambiente) ? (ambiente as Ambiente) : null,
      coluna,
      status_producao: Object.hasOwn(STATUS_PRODUCAO, status) ? (status as StatusProducao) : null,
      publicar_em,
      referencias: refs.slice(0, 10),
      post_id: texto(fd, "post_id", 64),
    },
  };
}

// ─── Quadro ───
export function agruparPorColuna(ideias: Ideia[]): Record<Coluna, Ideia[]> {
  const g: Record<Coluna, Ideia[]> = { garagem: [], pista: [], chegada: [] };
  for (const i of ideias) g[i.coluna]?.push(i);
  for (const c of Object.keys(g) as Coluna[]) g[c].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  return g;
}

// Nova ordem de uma coluna ao soltar `id` na posição `indice` (0 = topo).
export function reordenar(idsDaColuna: number[], id: number, indice: number): number[] {
  const sem = idsDaColuna.filter((x) => x !== id);
  const pos = Math.max(0, Math.min(indice, sem.length));
  return [...sem.slice(0, pos), id, ...sem.slice(pos)];
}

// ─── Calendário ───
export type DiaCalendario = { data: string; doMes: boolean; hoje: boolean };

// Semanas (domingo a sábado) que cobrem o mês. `mes` no formato AAAA-MM.
export function gradeDoMes(mes: string, hoje: string): DiaCalendario[][] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const inicio = new Date(primeiro);
  inicio.setUTCDate(1 - primeiro.getUTCDay());
  const semanas: DiaCalendario[][] = [];
  const cursor = new Date(inicio);
  do {
    const semana: DiaCalendario[] = [];
    for (let i = 0; i < 7; i++) {
      const data = cursor.toISOString().slice(0, 10);
      semana.push({ data, doMes: cursor.getUTCMonth() === m - 1, hoje: data === hoje });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    semanas.push(semana);
  } while (cursor.getUTCMonth() === m - 1);
  return semanas;
}

export function lerMes(v: unknown, hoje: string): string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : hoje.slice(0, 7);
}

export function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function porDia<T extends { publicar_em: string | null }>(itens: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const i of itens) {
    if (!i.publicar_em) continue;
    const { data } = partesSP(i.publicar_em);
    mapa.set(data, [...(mapa.get(data) ?? []), i]);
  }
  for (const lista of mapa.values()) lista.sort((a, b) => (a.publicar_em! < b.publicar_em! ? -1 : 1));
  return mapa;
}

// ─── Briefing ───
export const ETAPAS_BRIEFING = [
  {
    id: "antes",
    rotulo: "Antes de gravar",
    itens: [
      "Objetivo do conteúdo definido",
      "Roteiro ou tópicos escritos",
      "Gancho dos primeiros 3 segundos testado em voz alta",
      "Local, roupa e luz escolhidos",
      "Áudio testado",
    ],
  },
  {
    id: "gravacao",
    rotulo: "Gravação",
    itens: [
      "Takes principais gravados",
      "Pelo menos 2 versões do gancho",
      "Imagens de apoio (cobertura)",
      "Áudio e enquadramento conferidos",
    ],
  },
  {
    id: "publicacao",
    rotulo: "Edição e publicação",
    itens: [
      "Corte final e legendas na tela",
      "Capa escolhida",
      "Legenda com CTA escrita",
      "Data e horário agendados",
      "Link do post registrado no Hub",
    ],
  },
] as const;

export type Checklist = Record<string, boolean>;

export function chaveItem(etapa: string, indice: number) {
  return `${etapa}_${indice}`;
}

export function progressoChecklist(c: Checklist | null | undefined) {
  const total = ETAPAS_BRIEFING.reduce((s, e) => s + e.itens.length, 0);
  const feitos = ETAPAS_BRIEFING.reduce(
    (s, e) => s + e.itens.filter((_, i) => c?.[chaveItem(e.id, i)] === true).length,
    0,
  );
  return { feitos, total, pct: Math.round((feitos / total) * 100) };
}

// Mantém só chaves conhecidas com valor booleano (o que vem do cliente não é confiável).
export function limparChecklist(entrada: unknown): Checklist {
  const saida: Checklist = {};
  if (!entrada || typeof entrada !== "object") return saida;
  for (const e of ETAPAS_BRIEFING) {
    e.itens.forEach((_, i) => {
      const k = chaveItem(e.id, i);
      if ((entrada as Record<string, unknown>)[k] === true) saida[k] = true;
    });
  }
  return saida;
}
