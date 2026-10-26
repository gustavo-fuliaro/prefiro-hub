// Edge Function: gestão de usuários do Hub.
// - Conta administradora principal: vê todos, cria ambientes novos e equipes.
// - Admin de um ambiente: gerencia só a equipe do próprio ambiente (mesmos dados, papéis diferentes).
// Senhas ficam no Supabase Auth (bcrypt); a função só gera a senha provisória e a devolve uma única vez para o admin repassar.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type Gestor, gerarSenhaProvisoria, lerPedido, type Pedido, podeAgirSobre, podeCriar, podeGerirUsuarios, protegeSuperAdmin,
} from "../_shared/usuarios.ts";

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

async function listar(db: SupabaseClient, quem: Gestor) {
  const hub = db.schema("hub");
  let consulta = hub.from("membros").select("user_id, nome, papel, conta_id, super_admin, ativo, deve_trocar_senha");
  if (!quem.super_admin) consulta = consulta.eq("conta_id", quem.conta_id);
  const [{ data: membros, error }, { data: contas }] = await Promise.all([
    consulta,
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
      conta_id: m.conta_id,
      papel: m.papel,
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

async function quantosNaConta(db: SupabaseClient, contaId: number, papel?: string) {
  let q = db.schema("hub").from("membros").select("user_id", { count: "exact", head: true }).eq("conta_id", contaId);
  if (papel) q = q.eq("papel", papel).eq("ativo", true);
  const { count } = await q;
  return count ?? 0;
}

async function executar(db: SupabaseClient, quem: Gestor, p: Pedido) {
  const hub = db.schema("hub");

  if (p.acao === "listar") return { usuarios: await listar(db, quem) };

  if (p.acao === "criar" && p.destino === "equipe") {
    if (!podeCriar(quem, "equipe")) return { erro: "Você não pode cadastrar pessoas neste ambiente.", status: 403 };
    const senha = p.senha ?? gerarSenhaProvisoria();
    const { data: criado, error } = await db.auth.admin.createUser({
      email: p.email, password: senha, email_confirm: true, user_metadata: { nome: p.nome },
    });
    if (error || !criado.user) return { erro: erroAuth(error?.message ?? ""), status: 409 };
    const { error: eMembro } = await hub.from("membros").insert({
      user_id: criado.user.id, nome: p.nome, papel: p.papel, conta_id: quem.conta_id, deve_trocar_senha: true,
    });
    if (eMembro) {
      await db.auth.admin.deleteUser(criado.user.id);
      return { erro: "Não foi possível incluir a pessoa na equipe. Nada foi salvo.", status: 500 };
    }
    return { ok: `${p.nome} entrou na equipe.`, senha_provisoria: senha, email: p.email };
  }

  if (p.acao === "criar") {
    if (!podeCriar(quem, "novo_ambiente")) return { erro: "Só a conta principal cria ambientes novos.", status: 403 };
    const senha = p.senha ?? gerarSenhaProvisoria();
    const { data: criado, error } = await db.auth.admin.createUser({
      email: p.email, password: senha, email_confirm: true, user_metadata: { nome: p.nome },
    });
    if (error || !criado.user) return { erro: erroAuth(error?.message ?? ""), status: 409 };

    const { data: conta, error: eConta } = await hub.from("contas").insert({ nome: p.nome }).select("id").single();
    const { error: eMembro } = conta
      ? await hub.from("membros").insert({
          user_id: criado.user.id, nome: p.nome, papel: p.papel, conta_id: conta.id, deve_trocar_senha: true,
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
  if (!alvo || !podeAgirSobre(quem, alvo)) return { erro: "Usuário não encontrado.", status: 404 };
  if (alvo.super_admin && protegeSuperAdmin(p.acao)) {
    return { erro: "A conta administradora principal não pode ser bloqueada, excluída ou ter a senha redefinida por aqui.", status: 400 };
  }

  if (p.acao === "editar") {
    const { error } = await db.auth.admin.updateUserById(p.user_id, { email: p.email, email_confirm: true, user_metadata: { nome: p.nome } });
    if (error) return { erro: erroAuth(error.message), status: 409 };
    await hub.from("membros").update({ nome: p.nome }).eq("user_id", p.user_id);
    // O nome do ambiente acompanha o da pessoa só quando ela está sozinha nele.
    if (!alvo.super_admin && (await quantosNaConta(db, alvo.conta_id)) === 1) {
      await hub.from("contas").update({ nome: p.nome }).eq("id", alvo.conta_id);
    }
    return { ok: "Dados atualizados." };
  }

  if (p.acao === "papel") {
    if (alvo.papel === "admin" && p.papel !== "admin" && alvo.ativo && (await quantosNaConta(db, alvo.conta_id, "admin")) <= 1) {
      return { erro: "O ambiente precisa de pelo menos um admin ativo.", status: 400 };
    }
    const { error } = await hub.from("membros").update({ papel: p.papel }).eq("user_id", p.user_id);
    if (error) return { erro: "Não foi possível mudar o papel.", status: 500 };
    return { ok: `Papel de ${alvo.nome} atualizado.` };
  }

  if (p.acao === "status") {
    if (!p.ativo && alvo.papel === "admin" && alvo.ativo && (await quantosNaConta(db, alvo.conta_id, "admin")) <= 1 && (await quantosNaConta(db, alvo.conta_id)) > 1) {
      return { erro: "Defina outro admin no ambiente antes de bloquear este.", status: 400 };
    }
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

  // excluir: com mais gente no ambiente, sai só a pessoa (tarefas ficam sem responsável, comentários mantêm o nome).
  // Sozinha no ambiente, apaga também o ambiente inteiro (só a conta principal pode).
  const total = await quantosNaConta(db, alvo.conta_id);
  if (total > 1) {
    if (alvo.papel === "admin" && alvo.ativo && (await quantosNaConta(db, alvo.conta_id, "admin")) <= 1) {
      return { erro: "Defina outro admin no ambiente antes de excluir este.", status: 400 };
    }
    const { error } = await db.auth.admin.deleteUser(p.user_id);
    if (error) return { erro: "Não foi possível excluir o login.", status: 500 };
    return { ok: `${alvo.nome} saiu da equipe. Os dados do ambiente continuam.` };
  }
  if (!quem.super_admin) return { erro: "Só a conta principal exclui um ambiente inteiro.", status: 403 };
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
  if (!quem || !podeGerirUsuarios(quem)) return resposta({ erro: "Só admins gerenciam usuários." }, 403);

  const lido = lerPedido(await req.json().catch(() => ({})));
  if ("erro" in lido) return resposta({ erro: lido.erro }, 400);
  if ("user_id" in lido.pedido && lido.pedido.user_id === u.user.id && lido.pedido.acao !== "editar") {
    return resposta({ erro: "Você não pode bloquear, excluir ou redefinir a própria conta por aqui." }, 400);
  }

  try {
    const r = await executar(db, quem, lido.pedido);
    const status = "status" in r && typeof r.status === "number" ? r.status : 200;
    const { status: _s, ...corpo } = r as Record<string, unknown>;
    return resposta(corpo, status);
  } catch (e) {
    console.error("admin-usuarios", e);
    return resposta({ erro: "Erro inesperado na gestão de usuários." }, 500);
  }
});
