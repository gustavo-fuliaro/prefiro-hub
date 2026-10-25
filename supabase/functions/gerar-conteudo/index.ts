// Edge Function: gera conteúdo com o Claude para um perfil (ideias, roteiro ou análise).
// Responde na hora com o id do job e processa em segundo plano; a tela acompanha pelo hub.jobs.
// Segredo no Vault: anthropic_api_key.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  ESQUEMAS,
  SYSTEM_PROMPT,
  isTipoGeracao,
  montarPedido,
  validarSaida,
  type ContextoPerfil,
  type Posicionamento,
  type TipoGeracao,
} from "../_shared/estudio.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODELO = "claude-opus-5-5";
const PAPEIS = ["admin", "estrategista", "criador"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Pedido = { tipo: TipoGeracao; perfil_id: number; contexto?: string; quantidade?: number; ideia_id?: number };

async function carregarContexto(db: SupabaseClient, perfilId: number): Promise<ContextoPerfil> {
  const hub = db.schema("hub");
  const [{ data: perfil }, { data: resumo }, { data: pos }, { data: posts }, { data: ideias }] = await Promise.all([
    hub.from("perfis").select("handle, nome, bio").eq("id", perfilId).single(),
    hub.from("perfis_resumo").select("seguidores").eq("id", perfilId).maybeSingle(),
    hub.from("posicionamento").select("respostas, pilares").eq("perfil_id", perfilId).maybeSingle(),
    hub.from("posts").select("id, tipo, produto, legenda, publicado_em").eq("perfil_id", perfilId).order("publicado_em", { ascending: false }).limit(40),
    hub.from("ideias").select("titulo").eq("perfil_id", perfilId).order("atualizado_em", { ascending: false }).limit(80),
  ]);
  if (!perfil) throw new Error("Perfil não encontrado.");

  const ids = (posts ?? []).map((p) => p.id);
  const { data: metricas } = ids.length
    ? await hub.from("post_metricas").select("post_id, dia, likes, comentarios").in("post_id", ids).order("dia")
    : { data: [] };
  const inter = new Map<string, number>();
  for (const m of metricas ?? []) inter.set(m.post_id, (m.likes ?? 0) + (m.comentarios ?? 0));

  const melhores = (posts ?? [])
    .map((p) => ({ tipo: p.produto === "REELS" ? "Reel" : p.tipo, legenda: p.legenda, publicado_em: p.publicado_em, interacoes: inter.get(p.id) ?? 0 }))
    .sort((a, b) => b.interacoes - a.interacoes)
    .slice(0, 10);

  return {
    handle: perfil.handle,
    nome: perfil.nome,
    bio: perfil.bio,
    seguidores: resumo?.seguidores ?? null,
    posicionamento: (pos as Posicionamento | null) ?? null,
    melhoresPosts: melhores,
    ideiasExistentes: (ideias ?? []).map((i) => i.titulo),
  };
}

function mensagemErro(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Chave da Anthropic inválida. Confira o segredo anthropic_api_key no Vault.";
  if (e instanceof Anthropic.PermissionDeniedError) return "A chave da Anthropic não tem permissão para este modelo.";
  if (e instanceof Anthropic.RateLimitError) return "Limite de uso da Anthropic atingido. Tente de novo em alguns minutos.";
  // Falta de saldo vem como 400 sem classe própria; a mensagem da API é a única pista.
  if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) {
    return "A conta da Anthropic está sem créditos. Compre créditos em Plans & Billing no Claude Console e tente de novo.";
  }
  if (e instanceof Anthropic.APIError) return `Erro da Anthropic (${e.status ?? "sem status"}): ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

async function processar(db: SupabaseClient, jobId: string, userId: string, pedido: Pedido) {
  const hub = db.schema("hub");
  await hub.from("jobs").update({ status: "rodando" }).eq("id", jobId);
  try {
    const { data: chave } = await hub.rpc("segredo", { nome: "anthropic_api_key" });
    if (!chave) throw new Error("Falta cadastrar a chave da Anthropic (anthropic_api_key) no Vault do Supabase.");

    const ctx = await carregarContexto(db, pedido.perfil_id);
    let ideia = undefined;
    if (pedido.tipo === "roteiro") {
      const { data } = await hub.from("ideias").select("titulo, gancho, tese, formato, cta").eq("id", pedido.ideia_id ?? 0).eq("perfil_id", pedido.perfil_id).maybeSingle();
      if (!data) throw new Error("Ideia não encontrada para este perfil.");
      ideia = data;
    }
    const texto = montarPedido(pedido.tipo, ctx, { contexto: pedido.contexto, quantidade: pedido.quantidade, ideia });

    const client = new Anthropic({ apiKey: chave as string });
    // Fallback automático no servidor: se o modelo recusar por política, a API repete o pedido em outro modelo.
    const params = {
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMAS[pedido.tipo] } },
      messages: [{ role: "user", content: texto }],
    };
    // deno-lint-ignore no-explicit-any
    const r = await client.beta.messages.create(params as any);

    if (r.stop_reason === "refusal") throw new Error("A IA recusou este pedido. Reformule o direcionamento e tente de novo.");
    if (r.stop_reason === "max_tokens") throw new Error("A resposta ficou longa demais. Peça menos itens.");
    const json = r.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    let saida: unknown;
    try {
      saida = JSON.parse(json);
    } catch {
      throw new Error("A IA devolveu um formato inválido. Tente de novo.");
    }
    if (!validarSaida(pedido.tipo, saida)) throw new Error("A IA devolveu uma resposta vazia. Tente de novo.");

    const { data: material, error } = await hub
      .from("materiais_ia")
      .insert({
        perfil_id: pedido.perfil_id,
        tipo: pedido.tipo,
        entrada: { contexto: pedido.contexto ?? null, quantidade: pedido.quantidade ?? null, ideia_id: pedido.ideia_id ?? null },
        saida,
        status: "rascunho",
        criado_por: userId,
        ideia_id: pedido.ideia_id ?? null,
        job_id: jobId,
        modelo: r.model,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao gravar o material: ${error.message}`);

    await hub.from("jobs").update({
      status: "concluido",
      resultado: { material_id: material.id, uso: r.usage },
      terminado_em: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (e) {
    console.error("gerar-conteudo", jobId, e);
    await hub.from("jobs").update({ status: "erro", erro: mensagemErro(e), terminado_em: new Date().toISOString() }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } };
  if (!u?.user) return resposta({ erro: "Faça login para gerar conteúdo." }, 401);
  const { data: membro } = await db.schema("hub").from("membros").select("papel").eq("user_id", u.user.id).maybeSingle();
  if (!membro || !PAPEIS.includes(membro.papel)) return resposta({ erro: "Seu papel não permite gerar conteúdo." }, 403);

  // Cadeado do Estúdio (hub.config): bloqueado enquanto a conta da Anthropic não tem créditos.
  const { data: cadeado } = await db.schema("hub").from("config").select("valor").eq("chave", "estudio_liberado").maybeSingle();
  if (cadeado?.valor !== true) return resposta({ erro: "O Estúdio de IA está bloqueado. Um admin precisa liberá-lo." }, 423);

  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isTipoGeracao(corpo.tipo)) return resposta({ erro: "Tipo de geração inválido." }, 400);
  const perfilId = Number(corpo.perfil_id);
  if (!Number.isInteger(perfilId) || perfilId <= 0) return resposta({ erro: "Escolha o perfil." }, 400);
  const pedido: Pedido = {
    tipo: corpo.tipo,
    perfil_id: perfilId,
    contexto: typeof corpo.contexto === "string" ? corpo.contexto.slice(0, 3000) : undefined,
    quantidade: Number(corpo.quantidade) || undefined,
    ideia_id: Number(corpo.ideia_id) || undefined,
  };
  if (pedido.tipo === "roteiro" && !pedido.ideia_id) return resposta({ erro: "Escolha a ideia para o roteiro." }, 400);

  const { data: job, error } = await db.schema("hub").from("jobs")
    .insert({ tipo: `ia_${pedido.tipo}`, payload: pedido, status: "pendente", criado_por: u.user.id, perfil_id: perfilId })
    .select("id").single();
  if (error || !job) return resposta({ erro: "Não foi possível criar o job." }, 500);

  EdgeRuntime.waitUntil(processar(db, job.id, u.user.id, pedido));
  return resposta({ job_id: job.id }, 202);
});
