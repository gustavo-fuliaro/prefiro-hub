// Estúdio de IA: tipos de geração, esquemas de saída (JSON Schema estrito) e montagem dos prompts.
// Código puro, usado pela Edge Function e pelas telas. Testado com Vitest.

export const TIPOS_GERACAO = {
  ideias: { rotulo: "Ideias de conteúdo", descricao: "Lista de ideias com gancho, tese, formato e pilar." },
  roteiro: { rotulo: "Roteiro", descricao: "Roteiro completo de Reel ou carrossel para uma ideia do planejador." },
  analise: { rotulo: "O que está funcionando", descricao: "Leitura dos posts com mais interação e próximos testes." },
} as const;
export type TipoGeracao = keyof typeof TIPOS_GERACAO;

export function isTipoGeracao(v: unknown): v is TipoGeracao {
  return typeof v === "string" && Object.hasOwn(TIPOS_GERACAO, v);
}

export const FORMATOS_IA = ["Reel", "Carrossel", "Foto", "Story", "Live", "Vídeo longo"] as const;

// ─── Posicionamento ───
export const PERGUNTAS_POSICIONAMENTO = [
  { id: "publico", texto: "Para quem você fala? Descreva a pessoa e o momento de vida dela." },
  { id: "transformacao", texto: "Que mudança concreta você entrega para essa pessoa?" },
  { id: "crenca", texto: "Que ideia comum sobre consórcio ou dinheiro você contesta?" },
  { id: "historia", texto: "Que experiências suas comprovam o que você defende?" },
  { id: "provas", texto: "Que resultados, números ou casos você pode citar?" },
  { id: "tom", texto: "Como você fala? Expressões que usa e coisas que evita." },
  { id: "limites", texto: "Que assuntos ou abordagens ficam de fora do seu conteúdo?" },
  { id: "acao", texto: "Qual a ação principal que você quer que o seguidor faça?" },
] as const;
export const MIN_RESPOSTA = 20;

export type Pilar = { nome: string; descricao: string };
export type Posicionamento = { respostas: Record<string, string>; pilares: Pilar[] };

export function completudePosicionamento(p: Posicionamento | null) {
  const respondidas = PERGUNTAS_POSICIONAMENTO.filter((q) => (p?.respostas?.[q.id] ?? "").trim().length >= MIN_RESPOSTA).length;
  const pilares = (p?.pilares ?? []).filter((x) => x.nome.trim()).length;
  return { respondidas, total: PERGUNTAS_POSICIONAMENTO.length, pilares, pronto: respondidas >= 5 && pilares >= 2 };
}

// ─── Esquemas de saída (strict: additionalProperties false e todos os campos obrigatórios) ───
const str = { type: "string" } as const;
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const lista = (items: unknown) => ({ type: "array", items });

export const ESQUEMAS: Record<TipoGeracao, Record<string, unknown>> = {
  ideias: obj({
    ideias: lista(
      obj({
        titulo: str,
        gancho: str,
        tese: str,
        formato: { type: "string", enum: [...FORMATOS_IA] },
        pilar: str,
        cta: str,
        por_que: str,
      }),
    ),
  }),
  roteiro: obj({
    tipo: { type: "string", enum: ["reel", "carrossel"] },
    duracao_estimada: str,
    gancho: obj({ fala: str, cena: str, texto_tela: str }),
    blocos: lista(obj({ fala: str, cena: str })),
    fechamento: obj({ fala: str, cena: str }),
    cta: str,
    slides: lista(obj({ titulo: str, texto: str })),
    legenda: str,
    hashtags: lista(str),
  }),
  analise: obj({
    resumo: str,
    padroes: lista(obj({ titulo: str, evidencia: str, recomendacao: str })),
    formatos_que_funcionam: lista(str),
    proximos_testes: lista(str),
  }),
};

export type SaidaIdeias = {
  ideias: { titulo: string; gancho: string; tese: string; formato: string; pilar: string; cta: string; por_que: string }[];
};
export type SaidaRoteiro = {
  tipo: "reel" | "carrossel";
  duracao_estimada: string;
  gancho: { fala: string; cena: string; texto_tela: string };
  blocos: { fala: string; cena: string }[];
  fechamento: { fala: string; cena: string };
  cta: string;
  slides: { titulo: string; texto: string }[];
  legenda: string;
  hashtags: string[];
};
export type SaidaAnalise = {
  resumo: string;
  padroes: { titulo: string; evidencia: string; recomendacao: string }[];
  formatos_que_funcionam: string[];
  proximos_testes: string[];
};

// ─── Prompts ───
// O system prompt é fixo (bom para cache). Tudo que muda por pedido vai na mensagem do usuário.
export const SYSTEM_PROMPT = `Você é estrategista de conteúdo para Instagram de uma corretora de consórcio no Brasil.
Escreve em português do Brasil, no tom de quem assina o perfil, com frases curtas e concretas.

Regras:
- Use o posicionamento e os dados reais do perfil que vierem na mensagem. Não invente números, clientes ou resultados; quando faltar um dado, escreva de forma que não dependa dele.
- Consórcio é compra planejada, sem juros, com taxa de administração. Não prometa contemplação em prazo certo nem rentabilidade garantida, e não trate consórcio como investimento financeiro com retorno.
- Ganchos precisam funcionar nos 3 primeiros segundos e ser ditos em voz alta sem soar como anúncio.
- Evite clichês de marketing ("descubra o segredo", "você não vai acreditar") e emojis em excesso.
- Responda só no formato JSON pedido, sem texto fora dele.`;

export type ContextoPerfil = {
  handle: string;
  nome: string | null;
  bio: string | null;
  seguidores: number | null;
  posicionamento: Posicionamento | null;
  melhoresPosts: { tipo: string | null; legenda: string | null; interacoes: number; publicado_em: string | null }[];
  ideiasExistentes: string[];
};

function blocoPerfil(c: ContextoPerfil): string {
  const linhas = [
    `Perfil: @${c.handle}${c.nome ? ` (${c.nome})` : ""}`,
    c.seguidores !== null ? `Seguidores: ${c.seguidores}` : null,
    c.bio ? `Bio: ${c.bio}` : null,
  ].filter(Boolean);

  const pos = c.posicionamento;
  const pilares = (pos?.pilares ?? []).filter((p) => p.nome.trim());
  const respostas = PERGUNTAS_POSICIONAMENTO.filter((q) => (pos?.respostas?.[q.id] ?? "").trim()).map(
    (q) => `- ${q.texto}\n  ${pos!.respostas[q.id].trim()}`,
  );
  const partes = [`<perfil>\n${linhas.join("\n")}\n</perfil>`];
  partes.push(
    pilares.length
      ? `<pilares>\n${pilares.map((p) => `- ${p.nome}: ${p.descricao}`).join("\n")}\n</pilares>`
      : "<pilares>Não definidos. Proponha ideias variadas e diga o pilar que você sugere em cada uma.</pilares>",
  );
  if (respostas.length) partes.push(`<posicionamento>\n${respostas.join("\n")}\n</posicionamento>`);
  if (c.melhoresPosts.length) {
    partes.push(
      `<posts_com_mais_interacao>\n${c.melhoresPosts
        .map((p, i) => `${i + 1}. [${p.tipo ?? "post"}, ${p.interacoes} interações${p.publicado_em ? `, ${p.publicado_em.slice(0, 10)}` : ""}] ${(p.legenda ?? "sem legenda").replace(/\s+/g, " ").slice(0, 400)}`)
        .join("\n")}\n</posts_com_mais_interacao>`,
    );
  }
  return partes.join("\n\n");
}

export function montarPedido(
  tipo: TipoGeracao,
  ctx: ContextoPerfil,
  opts: { contexto?: string; quantidade?: number; ideia?: { titulo: string; gancho: string | null; tese: string | null; formato: string | null; cta: string | null } },
): string {
  const base = blocoPerfil(ctx);
  const extra = opts.contexto?.trim() ? `\n\n<direcionamento_da_equipe>\n${opts.contexto.trim().slice(0, 3000)}\n</direcionamento_da_equipe>` : "";

  if (tipo === "ideias") {
    const n = Math.max(3, Math.min(15, opts.quantidade ?? 8));
    const existentes = ctx.ideiasExistentes.length
      ? `\n\n<ideias_ja_no_planejador>\n${ctx.ideiasExistentes.slice(0, 60).map((t) => `- ${t}`).join("\n")}\n</ideias_ja_no_planejador>`
      : "";
    return `${base}${existentes}${extra}

Crie ${n} ideias de conteúdo novas para este perfil, distribuídas entre os pilares. Não repita as ideias que já estão no planejador.
Para cada ideia: título curto, gancho (a primeira frase falada), tese (o argumento central em 2 ou 3 frases), formato, pilar, CTA e por que a ideia deve funcionar para este público (use os posts com mais interação como referência quando fizer sentido).`;
  }

  if (tipo === "roteiro") {
    const i = opts.ideia;
    if (!i) throw new Error("Escolha a ideia para o roteiro.");
    const carrossel = (i.formato ?? "").toLowerCase().includes("carrossel");
    return `${base}${extra}

<ideia>
Título: ${i.titulo}
Gancho: ${i.gancho ?? "a definir"}
Tese: ${i.tese ?? "a definir"}
Formato: ${i.formato ?? "Reel"}
CTA desejado: ${i.cta ?? "use a ação principal do posicionamento"}
</ideia>

Escreva o roteiro completo desta ideia como ${carrossel ? "carrossel" : "Reel de 45 a 75 segundos"}.
${carrossel
  ? "Preencha tipo \"carrossel\", de 6 a 9 slides (o primeiro é a capa), legenda e hashtags. Deixe blocos vazio e preencha gancho, fechamento e cta com o texto da capa, do último slide e da chamada."
  : "Preencha tipo \"reel\", gancho (fala, cena e texto na tela), de 3 a 5 blocos de desenvolvimento, fechamento, CTA falado, legenda e hashtags. Deixe slides vazio."}
Use no máximo 8 hashtags relevantes para consórcio e para o público.`;
  }

  return `${base}${extra}

Analise os posts com mais interação deste perfil. Explique em linguagem simples o que eles têm em comum (tema, formato, gancho, tom), quais formatos estão funcionando e proponha de 3 a 5 testes concretos para as próximas semanas.
Cite os posts pelo número da lista como evidência. Se houver poucos posts, diga isso no resumo e seja cauteloso nas conclusões.`;
}

// Valida a forma mínima da saída antes de gravar (o esquema estrito já garante a estrutura).
export function validarSaida(tipo: TipoGeracao, saida: unknown): boolean {
  if (!saida || typeof saida !== "object") return false;
  const s = saida as Record<string, unknown>;
  if (tipo === "ideias") return Array.isArray(s.ideias) && s.ideias.length > 0;
  if (tipo === "roteiro") return (s.tipo === "reel" || s.tipo === "carrossel") && typeof s.legenda === "string";
  return typeof s.resumo === "string" && Array.isArray(s.padroes);
}
