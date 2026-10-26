// Lógica pura da coleta (sem rede e sem Deno): monta a URL do Business Discovery,
// interpreta a resposta da Meta e traduz erros. Testada com Vitest.

export const CAMPOS_MIDIA =
  "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,media_url,thumbnail_url";
// view_count: visualizações de Reels (pagas + orgânicas), disponível no Business Discovery.
export const CAMPO_VIEWS = "view_count";

export function urlBusinessDiscovery(opts: {
  versao: string;
  igUserId: string;
  handle: string;
  token: string;
  limiteMidias?: number;
  comViews?: boolean;
}): string {
  const limite = opts.limiteMidias ?? 25;
  const midia = opts.comViews === false ? CAMPOS_MIDIA : `${CAMPOS_MIDIA},${CAMPO_VIEWS}`;
  const campos =
    `business_discovery.username(${opts.handle})` +
    `{id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,` +
    `media.limit(${limite}){${midia}}}`;
  const qs = new URLSearchParams({ fields: campos, access_token: opts.token });
  return `https://graph.facebook.com/${opts.versao}/${opts.igUserId}?${qs.toString()}`;
}

export type PostColetado = {
  id: string;
  tipo: string | null;
  produto: string | null;
  legenda: string | null;
  permalink: string | null;
  publicado_em: string | null;
  likes: number | null; // null quando o perfil oculta curtidas
  comentarios: number | null;
  views: number | null; // só Reels; null em foto e carrossel
  imagem_url: string | null; // capa do vídeo ou a própria imagem
};

export type PerfilColetado = {
  ig_user_id: string;
  username: string;
  nome: string | null;
  bio: string | null;
  seguidores: number | null;
  seguindo: number | null;
  total_posts: number | null;
  foto_url: string | null;
  posts: PostColetado[];
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function interpretarBusinessDiscovery(json: unknown): PerfilColetado {
  const bd = (json as { business_discovery?: Record<string, unknown> })?.business_discovery;
  if (!bd || typeof bd !== "object") throw new Error("Resposta da Meta sem business_discovery.");
  const midias = ((bd.media as { data?: unknown[] })?.data ?? []) as Record<string, unknown>[];
  return {
    ig_user_id: String(bd.id ?? ""),
    username: String(bd.username ?? ""),
    nome: str(bd.name),
    bio: str(bd.biography),
    seguidores: num(bd.followers_count),
    seguindo: num(bd.follows_count),
    total_posts: num(bd.media_count),
    foto_url: str(bd.profile_picture_url),
    posts: midias
      .filter((m) => typeof m?.id === "string")
      .map((m) => ({
        id: m.id as string,
        tipo: str(m.media_type),
        produto: str(m.media_product_type),
        legenda: str(m.caption),
        permalink: str(m.permalink),
        publicado_em: str(m.timestamp),
        likes: num(m.like_count),
        comentarios: num(m.comments_count),
        views: num(m.view_count),
        imagem_url: str(m.thumbnail_url) ?? (m.media_type === "VIDEO" ? null : str(m.media_url)),
      })),
  };
}

// Traduz o erro da Graph API para uma frase que a equipe entende.
export function mensagemErroMeta(json: unknown, status: number): string {
  const e = (json as { error?: { code?: number; error_subcode?: number; message?: string } })?.error;
  if (!e) return `Erro HTTP ${status} da Meta.`;
  if (e.code === 190) return "Token da Meta inválido ou expirado. Gere um novo token.";
  if ([4, 17, 32, 613].includes(e.code ?? -1)) return "Limite de chamadas da Meta atingido. A próxima coleta tenta de novo.";
  if (e.code === 110 || e.error_subcode === 2207013 || e.error_subcode === 2207006)
    return "Perfil não encontrado ou não é conta Business/Creator.";
  if (e.code === 10 || e.code === 200) return "O token não tem permissão para esta consulta.";
  return `Meta: ${e.message ?? "erro desconhecido"}`;
}

// A Meta recusou um campo pedido (ex.: view_count em versões antigas da API): tenta de novo sem ele.
export function erroDeCampo(json: unknown): boolean {
  const e = (json as { error?: { code?: number; message?: string } })?.error;
  return e?.code === 100 && /field|campo/i.test(e.message ?? "");
}

// Id do post no Hub: o mesmo post pode ser monitorado por contas diferentes, então o id leva o perfil.
export function idPostHub(perfilId: number, mediaId: string): string {
  return `${perfilId}_${mediaId}`;
}

// Data do dia no fuso de São Paulo (AAAA-MM-DD).
export function diaSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}
