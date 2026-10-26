// Edge Function: gestão de usuários do Hub. Só a conta administradora principal (super admin ativo) usa.
// Cada usuário criado ganha uma conta (ambiente) própria e isolada. Senhas ficam no Supabase Auth
// (bcrypt); a função só gera a senha provisória e a devolve uma única vez para o admin repassar.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { gerarSenhaProvisoria, lerPedido, type Pedido, protegeSuperAdmin } from "../_shared/usuarios.ts";

const BLOQUEIO = "876000h"; // ~100 anos: bloqueia novos logins até ser liberado

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Membro = { user_id: string; nome: string; papel: string; conta_id: number; super_admin: boolean; ativo: boolean; deve_trocar_senha: boolean };

async function membro(db: SupabaseClient, userId: string): Promise<Membro | null> {
  const { data } = await db.schema("hub").from("membros")
    .select("user_id, nome, papel, conta_id, super_admin, ativo, deve_trocar_senha").eq("user_id", userId).maybeSingle();
  return (data as Membro | null) ?? null;
}

async function listar(db: SupabaseClient) {
  const hub = db.schema("hub");
  const [{ data: membros, error }, { data: contas }] = await Promise.all([
    hub.from("membros").select("user_id, nome, papel, conta_id, super_admin, ativo, deve_trocar_senha"),
    hub.from("contas").select("id, nome, criada_em"),
  ]);
  if (error) throw new Error(error.message);
  const auth = new Map<string, { email?: string; last_sign_in_at?: string | null; created_at?: string; banned_until?: string | null }>();
  for (let page = 1; page < 50; page++) {
    const { data, error: e } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (e) throw new Error(e.message);
    for (const u of data.users) auth.set(u.id, u as never);
    if (data.users.length < 200) break;
  }
  const nomeConta = new Map((contas ?? []).map((c) => [c.id as number, c.nome as string]));
  return (membros as Membro[]).map((m) => {
    const a = auth.get(m.user_id);
    return {
      user_id: m.user_id,
      nome: m.nome,
      email: a?.email ?? null,
      conta: nomeConta.get(m.conta_id) ?? null,
      super_admin: m.super_admin,
      ativo: m.ativo,
      deve_trocar_senha: m.deve_trocar_senha,
      criado_em: a?.created_at ?? null,
      ultimo_acesso: a?.last_sign_in_at ?? null,
    };
  }).sort((x, y) => Number(y.super_admin) - Number(x.super_admin) || x.nome.localeCompare(y.nome, "pt-BR"));
}

function erroAuth(msg: string): string {
  if (/already been registered|already exists|duplicate/i.test(msg)) return "Já existe um usuário com este e-mail.";
  if (/password/i.test(msg)) return "A senha não foi aceita. Use pelo menos 10 caracteres com letras e números.";
  return "Não foi possível concluir no serviço de login. Tente de novo.";
}

async function executar(db: SupabaseClient, p: Pedido) {
  const hub = db.schema("hub");

  if (p.acao === "listar") return { usuarios: await listar(db) };

  if (p.acao === "criar") {
    const senha = p.senha ?? gerarSenhaProvisoria();
    const { data: criado, error } = await db.auth.admin.createUser({
      email: p.email, password: senha, email_confirm: true, user_metadata: { nome: p.nome },
    });
    if (error || !criado.user) return { erro: erroAuth(error?.message ?? ""), status: 409 };

    const { data: conta, error: eConta } = await hub.from("contas").insert({ nome: p.nome }).select("id").single();
    const { error: eMembro } = conta
      ? await hub.from("membros").insert({
          user_id: criado.user.id, nome: p.nome, papel: "admin", conta_id: conta.id, deve_trocar_senha: true,
        })
      : { error: eConta };
    if (eConta || eMembro) {
      // Desfaz o que já foi criado para não deixar login sem ambiente.
      if (conta) await hub.from("contas").delete().eq("id", conta.id);
      await db.auth.admin.deleteUser(criado.user.id);
      return { erro: "Não foi possível criar o ambiente do usuário. Nada foi salvo.", status: 500 };
    }
    return { ok: `${p.nome} cadastrado com ambiente próprio.`, senha_provisoria: senha, email: p.email };
  }

  const alvo = await membro(db, p.user_id);
  if (!alvo) return { erro: "Usuário não encontrado.", status: 404 };
  if (alvo.super_admin && protegeSuperAdmin(p.acao)) {
    return { erro: "A conta administradora principal não pode ser bloqueada, excluída ou ter a senha redefinida por aqui.", status: 400 };
  }

  if (p.acao === "editar") {
    const { error } = await db.auth.admin.updateUserById(p.user_id, { email: p.email, email_confirm: true, user_metadata: { nome: p.nome } });
    if (error) return { erro: erroAuth(error.message), status: 409 };
    await hub.from("membros").update({ nome: p.nome }).eq("user_id", p.user_id);
    if (!alvo.super_admin) await hub.from("contas").update({ nome: p.nome }).eq("id", alvo.conta_id);
    return { ok: "Dados atualizados." };
  }

  if (p.acao === "status") {
    // Duas travas: o banco deixa de liberar dados (membros.ativo) e o login deixa de aceitar a conta.
    const { error } = await db.auth.admin.updateUserById(p.user_id, { ban_duration: p.ativo ? "none" : BLOQUEIO });
    if (error) return { erro: erroAuth(error.message), status: 500 };
    await hub.from("membros").update({ ativo: p.ativo }).eq("user_id", p.user_id);
    return { ok: p.ativo ? `Acesso de ${alvo.nome} liberado.` : `Acesso de ${alvo.nome} bloqueado.` };
  }

  if (p.acao === "redefinir_senha") {
    const senha = gerarSenhaProvisoria();
    const { error } = await db.auth.admin.updateUserById(p.user_id, { password: senha });
    if (error) return { erro: erroAuth(error.message), status: 500 };
    await hub.from("membros").update({ deve_trocar_senha: true }).eq("user_id", p.user_id);
    return { ok: `Nova senha provisória de ${alvo.nome} gerada.`, senha_provisoria: senha };
  }

  // excluir: apaga o ambiente inteiro do usuário (perfis, coletas, metas, ideias, alertas, relatórios) e o login.
  const { error: eConta } = await hub.from("contas").delete().eq("id", alvo.conta_id);
  if (eConta) return { erro: "Não foi possível apagar o ambiente do usuário.", status: 500 };
  const { error } = await db.auth.admin.deleteUser(p.user_id);
  if (error) return { erro: "O ambiente foi apagado, mas o login não. Tente excluir de novo.", status: 500 };
  return { ok: `${alvo.nome} e o ambiente dele foram excluídos.` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = jwt ? await db.auth.getUser(jwt) : { data: { user: null } };
  if (!u?.user) return resposta({ erro: "Faça login." }, 401);
  const quem = await membro(db, u.user.id);
  if (!quem?.super_admin || !quem.ativo) return resposta({ erro: "Só a conta administradora principal gerencia usuários." }, 403);

  const lido = lerPedido(await req.json().catch(() => ({})));
  if ("erro" in lido) return resposta({ erro: lido.erro }, 400);
  if ("user_id" in lido.pedido && lido.pedido.user_id === u.user.id && lido.pedido.acao !== "editar") {
    return resposta({ erro: "Você não pode bloquear, excluir ou redefinir a própria conta por aqui." }, 400);
  }

  try {
    const r = await executar(db, lido.pedido);
    const status = "status" in r && typeof r.status === "number" ? r.status : 200;
    const { status: _s, ...corpo } = r as Record<string, unknown>;
    return resposta(corpo, status);
  } catch (e) {
    console.error("admin-usuarios", e);
    return resposta({ erro: "Erro inesperado na gestão de usuários." }, 500);
  }
});
