// Formulários/Iscas (estilo Typeform): tipos de pergunta, lógica de pulo, validação das respostas,
// problemas antes de publicar, métricas e exportação. Código puro, testado com Vitest.
// O banco (hub.form_enviar e hub.form_problemas) é a autoridade; aqui se espelham as regras.
import { normalizarHandle } from "@/lib/perfis";

export type TipoPergunta =
  | "boas_vindas" | "mensagem"
  | "texto_curto" | "texto_longo" | "nome" | "email" | "telefone" | "instagram"
  | "cpf" | "cnpj" | "numero" | "moeda" | "data" | "escala"
  | "escolha_unica" | "multipla_escolha" | "lista" | "termos";

export type Operador = "igual" | "diferente" | "contem" | "nao_contem" | "maior" | "menor" | "preenchida" | "vazia";
export type Regra = { pergunta: string; operador: Operador; valor: string };
export type Condicao = { logica: "e" | "ou"; regras: Regra[] };

export type Pergunta = {
  id: string;
  tipo: TipoPergunta;
  titulo: string;
  descricao?: string;
  obrigatoria?: boolean;
  placeholder?: string;
  botao?: string; // texto do botão (boas-vindas e mensagem)
  opcoes?: string[];
  qualificacao?: { ativa: boolean; qualifica: boolean[] };
  escala?: { min: number; max: number; rotulo_min?: string; rotulo_max?: string };
  condicao?: Condicao | null;
};

export type Tema = { cor?: string; fundo?: "escuro" | "claro" };
export type Final = { titulo?: string; texto?: string; botao?: string; link?: string };
export type Modo = "passo" | "lista";

export type Formulario = {
  id: number;
  conta_id: number;
  titulo: string;
  descricao: string | null;
  slug: string;
  modo: Modo;
  tema: Tema;
  perguntas: Pergunta[];
  final: Final;
  publicado: { titulo: string; descricao: string | null; modo: Modo; tema: Tema; perguntas: Pergunta[]; final: Final } | null;
  publicado_em: string | null;
  pipeline_id: number | null;
  etapa_id: number | null;
  responsavel: string | null;
  perfil_id: number | null;
  etiqueta: string | null;
  visitas: number;
  criado_em: string;
  atualizado_em: string;
};

export const CAMPOS_FORMULARIO =
  "id, conta_id, titulo, descricao, slug, modo, tema, perguntas, final, publicado, publicado_em, pipeline_id, etapa_id, responsavel, perfil_id, etiqueta, visitas, criado_em, atualizado_em";

// Versão pública (o que /f/[slug] recebe de hub.form_publico).
export type FormularioPublico = { slug: string; titulo: string; descricao: string | null; modo: Modo; tema: Tema; perguntas: Pergunta[]; final: Final };

export type Valor = string | string[];
export type Respostas = Record<string, Valor>;

// ─── Catálogo de tipos ───────────────────────────────────────────────────────
export const TIPOS: { tipo: TipoPergunta; rotulo: string; grupo: "Telas" | "Contato" | "Texto" | "Números" | "Escolha" }[] = [
  { tipo: "boas_vindas", rotulo: "Boas-vindas", grupo: "Telas" },
  { tipo: "mensagem", rotulo: "Mensagem", grupo: "Telas" },
  { tipo: "nome", rotulo: "Nome", grupo: "Contato" },
  { tipo: "instagram", rotulo: "Instagram", grupo: "Contato" },
  { tipo: "email", rotulo: "E-mail", grupo: "Contato" },
  { tipo: "telefone", rotulo: "Telefone", grupo: "Contato" },
  { tipo: "cpf", rotulo: "CPF", grupo: "Contato" },
  { tipo: "cnpj", rotulo: "CNPJ", grupo: "Contato" },
  { tipo: "texto_curto", rotulo: "Texto curto", grupo: "Texto" },
  { tipo: "texto_longo", rotulo: "Texto longo", grupo: "Texto" },
  { tipo: "numero", rotulo: "Número", grupo: "Números" },
  { tipo: "moeda", rotulo: "Valor em R$", grupo: "Números" },
  { tipo: "data", rotulo: "Data", grupo: "Números" },
  { tipo: "escala", rotulo: "Escala", grupo: "Números" },
  { tipo: "escolha_unica", rotulo: "Escolha única", grupo: "Escolha" },
  { tipo: "multipla_escolha", rotulo: "Múltipla escolha", grupo: "Escolha" },
  { tipo: "lista", rotulo: "Lista (dropdown)", grupo: "Escolha" },
  { tipo: "termos", rotulo: "Aceite de termos", grupo: "Escolha" },
];
export const ROTULO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.rotulo])) as Record<TipoPergunta, string>;

export const OPERADORES: { op: Operador; rotulo: string; semValor?: boolean }[] = [
  { op: "igual", rotulo: "é igual a" },
  { op: "diferente", rotulo: "é diferente de" },
  { op: "contem", rotulo: "contém" },
  { op: "nao_contem", rotulo: "não contém" },
  { op: "maior", rotulo: "é maior que" },
  { op: "menor", rotulo: "é menor que" },
  { op: "preenchida", rotulo: "foi respondida", semValor: true },
  { op: "vazia", rotulo: "ficou em branco", semValor: true },
];

export const TEM_OPCOES: TipoPergunta[] = ["escolha_unica", "multipla_escolha", "lista"];

export function ehTela(p: Pick<Pergunta, "tipo">): boolean {
  return p.tipo === "boas_vindas" || p.tipo === "mensagem";
}

let contador = 0;
export function novoId(): string {
  contador = (contador + 1) % 1000;
  return `p${Date.now().toString(36)}${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const TITULO_PADRAO: Partial<Record<TipoPergunta, string>> = {
  boas_vindas: "Olá! Leva menos de um minuto.",
  mensagem: "Antes de continuar…",
  nome: "Qual é o seu nome?",
  instagram: "Qual é o seu @ no Instagram?",
  email: "Qual é o seu e-mail?",
  telefone: "Qual é o seu WhatsApp?",
  termos: "Concordo em receber contato da equipe sobre consórcio.",
};

export function novaPergunta(tipo: TipoPergunta): Pergunta {
  const p: Pergunta = { id: novoId(), tipo, titulo: TITULO_PADRAO[tipo] ?? "", obrigatoria: !ehTela({ tipo }) && tipo !== "texto_longo" };
  if (TEM_OPCOES.includes(tipo)) p.opcoes = ["Opção 1", "Opção 2"];
  if (tipo === "escala") p.escala = { min: 0, max: 10 };
  if (ehTela({ tipo })) p.botao = tipo === "boas_vindas" ? "Começar" : "Continuar";
  return p;
}

// ─── Lógica de pulo (mesma regra de hub.form_regra / hub.form_visivel) ─────────
function comoTexto(v: Valor | undefined): string {
  if (v === undefined || v === null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function numero(s: string): number {
  const n = Number(s.trim().replace(",", "."));
  return s.trim() === "" ? NaN : n;
}

export function avaliarRegra(r: Regra, respostas: Respostas): boolean {
  const bruto = respostas[r.pergunta];
  const av = comoTexto(bruto);
  const val = r.valor ?? "";
  switch (r.operador) {
    case "diferente":
      return av !== val;
    case "contem":
      return av.toLowerCase().includes(val.toLowerCase());
    case "nao_contem":
      return !av.toLowerCase().includes(val.toLowerCase());
    case "preenchida":
      return av.trim() !== "";
    case "vazia":
      return av.trim() === "";
    case "maior":
    case "menor": {
      const a = numero(av);
      const b = numero(val);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return r.operador === "maior" ? a > b : a < b;
    }
    default:
      return av === val || (Array.isArray(bruto) && bruto.includes(val));
  }
}

export function visivel(p: Pergunta, respostas: Respostas): boolean {
  const c = p.condicao;
  if (!c || !c.regras?.length) return true;
  return c.logica === "ou" ? c.regras.some((r) => avaliarRegra(r, respostas)) : c.regras.every((r) => avaliarRegra(r, respostas));
}

export function perguntasVisiveis(perguntas: Pergunta[], respostas: Respostas): Pergunta[] {
  return perguntas.filter((p) => visivel(p, respostas));
}

// Perguntas anteriores que podem servir de base para a condição de `indice`.
export function baseParaCondicao(perguntas: Pergunta[], indice: number): Pergunta[] {
  return perguntas.slice(0, indice).filter((p) => !ehTela(p));
}

// Ao mover ou excluir perguntas, a regra que aponta para pergunta que sumiu ou ficou depois é removida.
export function limparCondicoes(perguntas: Pergunta[]): Pergunta[] {
  return perguntas.map((p, i) => {
    if (!p.condicao) return p;
    const antes = new Set(baseParaCondicao(perguntas, i).map((x) => x.id));
    const regras = p.condicao.regras.filter((r) => antes.has(r.pergunta));
    return regras.length === p.condicao.regras.length ? p : { ...p, condicao: regras.length ? { ...p.condicao, regras } : null };
  });
}

// ─── Validação de cada resposta ──────────────────────────────────────────────
function digitos(s: string): string {
  return s.replace(/\D/g, "");
}

export function cpfValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function cnpjValido(v: string): boolean {
  const d = digitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

// null = resposta aceita; texto = o que dizer para a pessoa.
export function problemaResposta(p: Pergunta, valor: Valor | undefined): string | null {
  if (ehTela(p)) return null;
  const v = comoTexto(valor).trim();
  if (!v) {
    if (p.tipo === "termos" && p.obrigatoria) return "É preciso aceitar para continuar.";
    return p.obrigatoria ? "Esta pergunta é obrigatória." : null;
  }
  switch (p.tipo) {
    case "email":
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? null : "Confira o e-mail.";
    case "telefone": {
      const n = digitos(v).length;
      return n >= 10 && n <= 15 ? null : "Informe o telefone com DDD.";
    }
    case "instagram":
      return normalizarHandle(v) ? null : "Informe o @ do Instagram (letras, números, ponto e _).";
    case "cpf":
      return cpfValido(v) ? null : "CPF inválido.";
    case "cnpj":
      return cnpjValido(v) ? null : "CNPJ inválido.";
    case "numero":
    case "moeda":
      return Number.isNaN(numero(v.replace(/[R$\s.]/g, "").replace(",", "."))) ? "Use só números." : null;
    case "data":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Escolha uma data.";
    case "termos":
      return v === "aceito" ? null : "É preciso aceitar para continuar.";
    default:
      return v.length > 3000 ? "Resposta longa demais." : null;
  }
}

// ─── Antes de publicar (espelho de hub.form_problemas) ───────────────────────
export function problemasFormulario(
  f: Pick<Formulario, "titulo" | "perguntas" | "pipeline_id" | "etapa_id">,
  etapa: { nome: string; papel: string; exige: string } | null,
): string[] {
  const p: string[] = [];
  if (!f.titulo.trim()) p.push("Dê um título ao formulário.");
  const resp = f.perguntas.filter((q) => !ehTela(q));
  if (!resp.length) p.push("Adicione pelo menos uma pergunta.");
  if (f.perguntas.length > 60) p.push("Use até 60 perguntas.");
  resp.forEach((q, i) => {
    if (!q.titulo.trim()) p.push(`A pergunta ${i + 1} está sem título.`);
    if (TEM_OPCOES.includes(q.tipo)) {
      const ops = (q.opcoes ?? []).filter((o) => o.trim());
      if (ops.length < 2) p.push(`"${q.titulo || "Pergunta"}" precisa de pelo menos 2 opções.`);
      if (new Set(ops).size !== ops.length) p.push(`"${q.titulo || "Pergunta"}" tem opções repetidas.`);
      if (q.qualificacao?.ativa && !q.qualificacao.qualifica.some(Boolean)) p.push(`Marque ao menos uma opção que qualifica em "${q.titulo || "Pergunta"}".`);
    }
  });
  const fixa = (tipo: TipoPergunta) => f.perguntas.some((q) => q.tipo === tipo && q.obrigatoria && !q.condicao?.regras?.length);
  if (f.pipeline_id) {
    if (!f.etapa_id || !etapa) p.push("Escolha a etapa em que o lead entra no funil.");
    else if (["reservatorio", "terminal", "futuro"].includes(etapa.papel) || ["justificativa", "data_retorno"].includes(etapa.exige)) {
      p.push(`A etapa ${etapa.nome} não recebe leads de formulário. Escolha outra.`);
    } else if (etapa.exige === "contato" && !(fixa("email") && fixa("telefone"))) {
      p.push(`A etapa ${etapa.nome} pede telefone e e-mail: inclua as duas perguntas como obrigatórias e sem condição.`);
    }
    if (!fixa("instagram")) p.push('Para criar leads no funil, inclua a pergunta "Instagram" como obrigatória e sem condição (o @ identifica o lead).');
  }
  return p;
}

// ─── Endereço público ────────────────────────────────────────────────────────
export function slugAleatorio(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return s;
}

export function lerSlug(v: string): string | null {
  const s = v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(s) ? s : null;
}

// ─── Respostas: métricas e exportação ────────────────────────────────────────
export type RespostaForm = {
  id: number;
  respostas: Respostas;
  origem: Record<string, string>;
  iniciado_em: string;
  concluido_em: string | null;
  qualificado: boolean | null;
  lead_id: number | null;
  lead_status: "criado" | "existente" | "sem_funil" | "erro" | null;
  lead_erro: string | null;
};

export function metricas(visitas: number, respostas: Pick<RespostaForm, "respostas" | "concluido_em" | "qualificado">[]) {
  const iniciadas = respostas.filter((r) => Object.keys(r.respostas ?? {}).length > 0 || r.concluido_em).length;
  const concluidas = respostas.filter((r) => r.concluido_em).length;
  const qualificadas = respostas.filter((r) => r.concluido_em && r.qualificado === true).length;
  return {
    visitas,
    iniciadas,
    concluidas,
    qualificadas,
    conversao: visitas > 0 ? concluidas / visitas : null, // visitas que viraram resposta completa
    abandono: iniciadas > 0 ? (iniciadas - concluidas) / iniciadas : null, // começaram e não terminaram
  };
}

export function textoResposta(v: Valor | undefined, p?: Pergunta): string {
  const t = comoTexto(v);
  if (p?.tipo === "termos") return t === "aceito" ? "Aceito" : "";
  if (p?.tipo === "data" && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t.split("-").reverse().join("/");
  return t;
}

function celulaCsv(s: string): string {
  // Evita que o Excel interprete o texto como fórmula.
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

// CSV com ";" (padrão do Excel em português) e BOM para os acentos abrirem certo.
export function respostasParaCsv(perguntas: Pergunta[], lista: RespostaForm[], fuso: string): string {
  const cols = perguntas.filter((p) => !ehTela(p));
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso });
  const cab = ["Enviado em", "Situação", "Qualificado", ...cols.map((p) => p.titulo || "Pergunta"), "Origem"];
  const linhas = lista.map((r) => [
    r.concluido_em ? quando.format(new Date(r.concluido_em)) : "",
    r.concluido_em ? "Concluída" : "Parcial",
    r.qualificado === null ? "" : r.qualificado ? "Sim" : "Não",
    ...cols.map((p) => textoResposta(r.respostas?.[p.id], p)),
    Object.entries(r.origem ?? {}).map(([k, v]) => `${k}=${v}`).join(" "),
  ]);
  return "﻿" + [cab, ...linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n");
}
