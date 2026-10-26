"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialogo } from "@/components/dialogo";
import { problemaSenha, type UsuarioLista } from "@/lib/usuarios";
import { chamarGestao, type RespostaUsuarios } from "./actions";

const campo = "h-10 rounded-md border border-line bg-bg px-3 font-normal text-ink";
const btn = "rounded-md px-3 py-1.5 text-sm font-medium";
const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const data = (iso: string | null) => (iso ? quando.format(new Date(iso)) : "Nunca");

type Modal =
  | { tipo: "senha"; nome: string; email: string; senha: string }
  | { tipo: "editar"; u: UsuarioLista }
  | { tipo: "bloquear"; u: UsuarioLista }
  | { tipo: "redefinir"; u: UsuarioLista }
  | { tipo: "excluir"; u: UsuarioLista };

function Situacao({ u }: { u: UsuarioLista }) {
  if (!u.ativo) return <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">Bloqueado</span>;
  if (u.deve_trocar_senha) return <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn">Ativo · aguardando troca de senha</span>;
  return <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">Ativo</span>;
}

function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }).catch(() => {})}
      className={`${btn} border border-line hover:border-accent`}
    >
      {ok ? "Copiado" : "Copiar"}
    </button>
  );
}

export function GestaoUsuarios({ usuarios, eu }: { usuarios: UsuarioLista[]; eu: string }) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal | null>(null);
  const [aviso, setAviso] = useState<{ ok?: string; erro?: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const [definirSenha, setDefinirSenha] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function executar(corpo: Record<string, unknown>, depois?: (r: RespostaUsuarios) => void) {
    iniciar(async () => {
      const r = await chamarGestao(corpo);
      setAviso(r.erro ? { erro: r.erro } : { ok: r.ok });
      if (!r.erro) {
        router.refresh();
        depois?.(r);
      }
    });
  }

  function cadastrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const senha = definirSenha ? String(fd.get("senha") ?? "") : "";
    if (definirSenha) {
      const p = problemaSenha(senha);
      if (p) return setErroForm(p);
    }
    setErroForm(null);
    const nome = String(fd.get("nome") ?? "");
    executar({ acao: "criar", nome, email: fd.get("email"), senha: senha || undefined }, (r) => {
      form.reset();
      setDefinirSenha(false);
      if (r.senha_provisoria && !senha) setModal({ tipo: "senha", nome, email: r.email ?? "", senha: r.senha_provisoria });
    });
  }

  const outros = usuarios.filter((u) => !u.super_admin).length;

  return (
    <>
      <section className="grid gap-4 rounded-balao border border-line bg-surface p-5 shadow-card">
        <div>
          <h2 className="font-display text-lg font-bold">Novo usuário</h2>
          <p className="text-sm text-muted">A pessoa recebe um ambiente vazio e só dela. No primeiro acesso, ela cria a própria senha.</p>
        </div>
        <form onSubmit={cadastrar} className="grid gap-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Nome
              <input name="nome" required minLength={2} maxLength={120} className={campo} placeholder="Nome da pessoa ou empresa" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              E-mail de acesso
              <input name="email" type="email" required className={campo} placeholder="nome@empresa.com.br" autoComplete="off" />
            </label>
          </div>
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1 font-medium">Senha de acesso</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="modo" checked={!definirSenha} onChange={() => setDefinirSenha(false)} />
              Gerar uma senha provisória segura (recomendado)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="modo" checked={definirSenha} onChange={() => setDefinirSenha(true)} />
              Definir a senha provisória agora
            </label>
            {definirSenha && (
              <input name="senha" type="password" autoComplete="new-password" minLength={10} className={`${campo} max-w-sm`} placeholder="10+ caracteres, letras e números" />
            )}
          </fieldset>
          {erroForm && <p role="alert" className="text-sm text-danger">{erroForm}</p>}
          <div>
            <button type="submit" disabled={pendente} className="h-10 rounded-balao-sm bg-accent px-5 font-semibold text-accent-ink hover:brightness-105 disabled:opacity-60">
              {pendente ? "Salvando…" : "Cadastrar usuário"}
            </button>
          </div>
        </form>
      </section>

      <p aria-live="polite" className="min-h-5 text-sm">
        {aviso?.erro && <span className="text-danger">{aviso.erro}</span>}
        {aviso?.ok && <span className="text-ok">{aviso.ok}</span>}
      </p>

      <section className="grid gap-3">
        <h2 className="font-display text-lg font-bold">
          Usuários cadastrados <span className="font-sans text-base font-normal text-muted">({outros} além da conta principal)</span>
        </h2>
        <ul className="grid gap-2">
          {usuarios.map((u) => (
            <li key={u.user_id} className="grid gap-3 rounded-balao border border-line bg-surface p-4 shadow-card lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{u.nome}</span>
                  {u.super_admin && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">Conta principal</span>}
                  {u.user_id === eu && <span className="text-xs text-muted">(você)</span>}
                </div>
                <div className="truncate text-sm text-muted">{u.email ?? "sem e-mail"}</div>
              </div>
              <div className="grid gap-1 text-xs text-muted">
                <Situacao u={u} />
                <span>Criado: {data(u.criado_em)} · Último acesso: {data(u.ultimo_acesso)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                <button type="button" onClick={() => setModal({ tipo: "editar", u })} className={`${btn} border border-line hover:border-accent`}>
                  Editar
                </button>
                {!u.super_admin && (
                  <>
                    {u.ativo ? (
                      <button type="button" onClick={() => setModal({ tipo: "bloquear", u })} className={`${btn} border border-line hover:border-accent`}>
                        Bloquear
                      </button>
                    ) : (
                      <button type="button" disabled={pendente} onClick={() => executar({ acao: "status", user_id: u.user_id, ativo: true })} className={`${btn} border border-ok text-ok hover:bg-ok-soft`}>
                        Liberar acesso
                      </button>
                    )}
                    <button type="button" onClick={() => setModal({ tipo: "redefinir", u })} className={`${btn} border border-line hover:border-accent`}>
                      Redefinir senha
                    </button>
                    <button type="button" onClick={() => setModal({ tipo: "excluir", u })} className={`${btn} text-danger hover:bg-danger-soft`}>
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {modal?.tipo === "senha" && (
        <Dialogo titulo="Senha provisória" aoFechar={() => setModal(null)} largura="sm"
          descricao={<>Passe estes dados para {modal.nome} por um canal seguro. A senha aparece só agora.</>}>
          <dl className="grid gap-2 text-sm">
            <dt className="text-muted">E-mail</dt>
            <dd className="font-medium">{modal.email}</dd>
            <dt className="text-muted">Senha provisória</dt>
            <dd className="flex items-center gap-2">
              <code className="rounded-md bg-bg px-3 py-2 font-mono text-base tracking-wide select-all">{modal.senha}</code>
              <Copiar texto={modal.senha} />
            </dd>
          </dl>
          <p className="text-sm text-muted">No primeiro acesso, o Hub pede para a pessoa criar uma senha só dela.</p>
        </Dialogo>
      )}

      {modal?.tipo === "editar" && (
        <Dialogo titulo={`Editar ${modal.u.nome}`} aoFechar={() => setModal(null)} largura="sm">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              executar({ acao: "editar", user_id: modal.u.user_id, nome: fd.get("nome"), email: fd.get("email") }, () => setModal(null));
            }}
          >
            <label className="grid gap-1 text-sm font-medium">
              Nome
              <input name="nome" required minLength={2} maxLength={120} defaultValue={modal.u.nome} className={campo} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              E-mail de acesso
              <input name="email" type="email" required defaultValue={modal.u.email ?? ""} className={campo} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className={`${btn} border border-line`}>Cancelar</button>
              <button type="submit" disabled={pendente} className={`${btn} bg-accent font-semibold text-accent-ink disabled:opacity-60`}>{pendente ? "Salvando…" : "Salvar"}</button>
            </div>
          </form>
        </Dialogo>
      )}

      {modal?.tipo === "bloquear" && (
        <Dialogo titulo={`Bloquear ${modal.u.nome}?`} aoFechar={() => setModal(null)} largura="sm"
          descricao="A pessoa perde o acesso na hora e não consegue mais entrar. Os dados do ambiente dela ficam guardados e voltam quando você liberar.">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className={`${btn} border border-line`}>Cancelar</button>
            <button type="button" disabled={pendente} onClick={() => executar({ acao: "status", user_id: modal.u.user_id, ativo: false }, () => setModal(null))}
              className={`${btn} bg-danger font-semibold text-white disabled:opacity-60`}>
              {pendente ? "Bloqueando…" : "Bloquear acesso"}
            </button>
          </div>
        </Dialogo>
      )}

      {modal?.tipo === "redefinir" && (
        <Dialogo titulo={`Redefinir a senha de ${modal.u.nome}?`} aoFechar={() => setModal(null)} largura="sm"
          descricao="A senha atual deixa de funcionar. O Hub gera uma senha provisória e, no próximo acesso, pede uma senha nova.">
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className={`${btn} border border-line`}>Cancelar</button>
            <button type="button" disabled={pendente}
              onClick={() => {
                const u = modal.u;
                executar({ acao: "redefinir_senha", user_id: u.user_id }, (r) =>
                  setModal(r.senha_provisoria ? { tipo: "senha", nome: u.nome, email: u.email ?? "", senha: r.senha_provisoria } : null),
                );
              }}
              className={`${btn} bg-accent font-semibold text-accent-ink disabled:opacity-60`}>
              {pendente ? "Gerando…" : "Gerar senha provisória"}
            </button>
          </div>
        </Dialogo>
      )}

      {modal?.tipo === "excluir" && <ConfirmarExclusao u={modal.u} pendente={pendente} aoFechar={() => setModal(null)}
        aoConfirmar={() => executar({ acao: "excluir", user_id: modal.u.user_id }, () => setModal(null))} />}
    </>
  );
}

function ConfirmarExclusao({ u, pendente, aoFechar, aoConfirmar }: { u: UsuarioLista; pendente: boolean; aoFechar: () => void; aoConfirmar: () => void }) {
  const [digitado, setDigitado] = useState("");
  const alvo = u.email ?? u.nome;
  return (
    <Dialogo titulo={`Excluir ${u.nome}?`} aoFechar={aoFechar} largura="sm"
      descricao="Apaga o login e todo o ambiente da pessoa: perfis, histórico de números, metas, ideias, relatórios e alertas. Não dá para desfazer.">
      <label className="grid gap-1 text-sm font-medium">
        Para confirmar, digite {alvo}
        <input value={digitado} onChange={(e) => setDigitado(e.target.value)} className={campo} autoComplete="off" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoFechar} className={`${btn} border border-line`}>Cancelar</button>
        <button type="button" disabled={pendente || digitado.trim().toLowerCase() !== alvo.toLowerCase()} onClick={aoConfirmar}
          className={`${btn} bg-danger font-semibold text-white disabled:opacity-50`}>
          {pendente ? "Excluindo…" : "Excluir definitivamente"}
        </button>
      </div>
    </Dialogo>
  );
}
