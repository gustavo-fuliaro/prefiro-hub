// Edge Function: coleta diária dos perfis do Hub pela API oficial da Meta (Business Discovery).
// Disparada pelo pg_cron (cabeçalho x-cron-secret, todas as contas) ou pelo botão "Coletar agora"
// (JWT de admin/estrategista ativo, só os perfis da conta de quem clicou).
// Segredos ficam no Vault do Supabase: meta_access_token, meta_ig_user_id, hub_cron_secret.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  diaSaoPaulo,
  erroDeCampo,
  idPostHub,
  interpretarBusinessDiscovery,
  mensagemErroMeta,
  type PerfilColetado,
  urlBusinessDiscovery,
} from "../_shared/instagram.ts";

const VERSAO_GRAPH = Deno.env.get("META_GRAPH_VERSION") ?? "v23.0";
const BUCKET = "hub-midia";
const PAUSA_MS = 600; // entre perfis, para respeitar o limite da Meta
const IMAGENS_POR_PERFIL = 12; // capas novas baixadas por execução

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Perfil = { id: number; handle: string; nome: string | null };

async function segredo(db: SupabaseClient, nome: string): Promise<string | null> {
  const { data, error } = await db.schema("hub").rpc("segredo", { nome });
  if (error) throw new Error(`Não foi possível ler o segredo ${nome}: ${error.message}`);
  return (data as string | null) ?? null;
}

type Acesso = { origem: "cron" | "manual"; userId: string | null; contaId: number | null };

async function autorizar(req: Request, db: SupabaseClient): Promise<Acesso | null> {
  const cronHeader = req.headers.get("x-cron-secret");
  if (cronHeader) {
    const esperado = await segredo(db, "hub_cron_secret");
    return esperado && cronHeader === esperado ? { origem: "cron", userId: null, contaId: null } : null;
  }
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return null;
  const { data: m } = await db.schema("hub").from("membros").select("papel, conta_id, ativo").eq("user_id", u.user.id).maybeSingle();
  return m && m.ativo && ["admin", "estrategista"].includes(m.papel)
    ? { origem: "manual", userId: u.user.id, contaId: m.conta_id as number }
    : null;
}

async function copiarImagem(db: SupabaseClient, url: string, caminho: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(tipo)) return null;
    const { error } = await db.storage.from(BUCKET).upload(caminho, await r.arrayBuffer(), { contentType: tipo, upsert: true });
    return error ? null : caminho;
  } catch {
    return null;
  }
}

async function salvar(db: SupabaseClient, perfil: Perfil, c: PerfilColetado, dia: string) {
  const hub = db.schema("hub");

  const { error: eSnap } = await hub.from("snapshots_diarios").upsert(
    { perfil_id: perfil.id, dia, seguidores: c.seguidores, seguindo: c.seguindo, total_posts: c.total_posts, fonte: "business_discovery", coletado_em: new Date().toISOString() },
    { onConflict: "perfil_id,dia" },
  );
  if (eSnap) throw new Error(`Falha ao gravar números do dia: ${eSnap.message}`);

  if (c.posts.length) {
    const ids = c.posts.map((p) => idPostHub(perfil.id, p.id));
    const { data: existentes } = await hub.from("posts").select("id, thumb_path").in("id", ids);
    const comCapa = new Set((existentes ?? []).filter((p) => p.thumb_path).map((p) => p.id));

    let baixadas = 0;
    const linhas = [];
    for (const p of c.posts) {
      let thumb: string | null = null;
      const id = idPostHub(perfil.id, p.id);
      if (!comCapa.has(id) && p.imagem_url && baixadas < IMAGENS_POR_PERFIL) {
        thumb = await copiarImagem(db, p.imagem_url, `${perfil.handle}/posts/${p.id}.jpg`);
        baixadas++;
      }
      linhas.push({
        id, media_id: p.id, perfil_id: perfil.id, tipo: p.tipo, produto: p.produto, legenda: p.legenda,
        permalink: p.permalink, publicado_em: p.publicado_em,
        ...(thumb ? { thumb_path: thumb } : {}),
      });
    }
    const { error: ePosts } = await hub.from("posts").upsert(linhas, { onConflict: "id" });
    if (ePosts) throw new Error(`Falha ao gravar posts: ${ePosts.message}`);

    const { error: eMet } = await hub.from("post_metricas").upsert(
      c.posts.map((p) => ({ post_id: idPostHub(perfil.id, p.id), dia, likes: p.likes, comentarios: p.comentarios, views: p.views })),
      { onConflict: "post_id,dia" },
    );
    if (eMet) throw new Error(`Falha ao gravar métricas dos posts: ${eMet.message}`);
  }

  const foto = c.foto_url ? await copiarImagem(db, c.foto_url, `${perfil.handle}/perfil.jpg`) : null;
  await hub.from("perfis").update({
    ig_user_id: c.ig_user_id || null,
    nome: perfil.nome ?? c.nome,
    bio: c.bio,
    ...(foto ? { foto_path: foto } : {}),
    ultima_coleta_em: new Date().toISOString(),
    ultimo_erro: null,
  }).eq("id", perfil.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const acesso = await autorizar(req, db).catch(() => null);
  if (!acesso) return resposta({ erro: "Sem permissão para disparar a coleta." }, 401);

  const corpo = await req.json().catch(() => ({})) as { perfil_id?: number };
  const hub = db.schema("hub");

  const token = await segredo(db, "meta_access_token");
  const igUserId = await segredo(db, "meta_ig_user_id");
  if (!token || !igUserId) {
    return resposta({ erro: "Falta configurar meta_access_token e/ou meta_ig_user_id no Vault do Supabase." }, 500);
  }

  let consulta = hub.from("perfis").select("id, handle, nome").eq("ativo", true).order("id");
  if (acesso.contaId !== null) consulta = consulta.eq("conta_id", acesso.contaId);
  if (corpo.perfil_id) consulta = consulta.eq("id", corpo.perfil_id);
  const { data: perfis, error } = await consulta;
  if (error) return resposta({ erro: error.message }, 500);

  const { data: coleta } = await hub.from("coletas")
    .insert({ origem: acesso.origem, disparada_por: acesso.userId, conta_id: acesso.contaId })
    .select("id").single();

  const dia = diaSaoPaulo();
  const detalhes: { handle: string; ok: boolean; erro?: string }[] = [];

  for (const [i, perfil] of (perfis as Perfil[]).entries()) {
    if (i > 0) await dormir(PAUSA_MS);
    try {
      const pedir = (comViews: boolean) =>
        fetch(urlBusinessDiscovery({ versao: VERSAO_GRAPH, igUserId, handle: perfil.handle, token, comViews }));
      let r = await pedir(true);
      let json = await r.json().catch(() => ({}));
      if (!r.ok && erroDeCampo(json)) {
        r = await pedir(false);
        json = await r.json().catch(() => ({}));
      }
      if (!r.ok) throw new Error(mensagemErroMeta(json, r.status));
      await salvar(db, perfil, interpretarBusinessDiscovery(json), dia);
      detalhes.push({ handle: perfil.handle, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await hub.from("perfis").update({ ultimo_erro: msg, ultima_coleta_em: new Date().toISOString() }).eq("id", perfil.id);
      detalhes.push({ handle: perfil.handle, ok: false, erro: msg });
    }
  }

  const ok = detalhes.filter((d) => d.ok).length;
  if (coleta) {
    await hub.from("coletas").update({
      terminada_em: new Date().toISOString(), perfis_ok: ok, perfis_erro: detalhes.length - ok, detalhes,
    }).eq("id", coleta.id);
  }

  return resposta({ dia, perfis_ok: ok, perfis_erro: detalhes.length - ok, detalhes });
});
