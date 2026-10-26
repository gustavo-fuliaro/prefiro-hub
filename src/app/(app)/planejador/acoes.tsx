"use client";

import { useState } from "react";
import { Dialogo } from "@/components/dialogo";
import { atualizarTarefa, criarTarefa, excluirTarefa } from "@/lib/tarefas-api";
import {
  dadosDuplicados, estaConcluida, mudancaConcluir, mudancaReabrir, STATUS_LABEL, STATUS_ORDEM, type Status, type Tarefa,
} from "@/lib/tarefas";
import { TarefaForm } from "./tarefa-form";
import { botao, botaoPrimario, campo, type Contexto, type ItemMenu } from "./ui";

type Modal =
  | { tipo: "editar"; t: Tarefa }
  | { tipo: "renomear"; t: Tarefa }
  | { tipo: "responsavel"; t: Tarefa }
  | { tipo: "status"; t: Tarefa }
  | { tipo: "excluir"; t: Tarefa };

// Ações de uma tarefa, iguais no Kanban, nos detalhes, no calendário e nos arquivados.
// aoMudar recebe a tarefa como o banco devolveu; aoRemover recebe o id excluído.
export function useAcoesTarefa(ctx: Contexto, aoMudar: (t: Tarefa) => void, aoRemover: (id: number) => void) {
  const [modal, setModal] = useState<Modal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(t: Tarefa, mudanca: Partial<Tarefa>) {
    setErro(null);
    setOcupado(true);
    const r = await atualizarTarefa(t.id, mudanca);
    setOcupado(false);
    if (r.erro) {
      setErro(r.erro);
      return false;
    }
    aoMudar(r.ok!);
    return true;
  }

  const concluir = (t: Tarefa) => salvar(t, mudancaConcluir(t, new Date().toISOString()));
  const reabrir = (t: Tarefa) => salvar(t, mudancaReabrir(t));
  const arquivar = (t: Tarefa) => salvar(t, { arquivada_em: new Date().toISOString(), arquivada_auto: false });
  const restaurar = (t: Tarefa) => salvar(t, { arquivada_em: null });

  async function duplicar(t: Tarefa) {
    setErro(null);
    const r = await criarTarefa(dadosDuplicados(t));
    if (r.erro) return setErro(r.erro);
    aoMudar(r.ok!);
  }

  function itensMenu(t: Tarefa, extra: { abrir?: () => void } = {}): ItemMenu[] {
    const arquivada = t.arquivada_em !== null;
    const ed = ctx.podeEditar;
    return [
      { rotulo: "Abrir detalhes", acao: () => extra.abrir?.(), oculto: !extra.abrir },
      { rotulo: "Renomear", acao: () => setModal({ tipo: "renomear", t }), oculto: !ed },
      { rotulo: "Editar", acao: () => setModal({ tipo: "editar", t }), oculto: !ed },
      { rotulo: "Duplicar", acao: () => duplicar(t), oculto: !ed },
      { rotulo: "Alterar responsável", acao: () => setModal({ tipo: "responsavel", t }), oculto: !ed },
      { rotulo: "Alterar status", acao: () => setModal({ tipo: "status", t }), oculto: !ed },
      estaConcluida(t)
        ? { rotulo: "Reabrir", acao: () => reabrir(t), oculto: !ed }
        : { rotulo: t.status === "agendado" ? "Marcar como publicado" : "Concluir", acao: () => concluir(t), oculto: !ed },
      arquivada
        ? { rotulo: "Restaurar", acao: () => restaurar(t), oculto: !ed }
        : { rotulo: "Arquivar", acao: () => arquivar(t), oculto: !ed },
      { rotulo: "Excluir", acao: () => setModal({ tipo: "excluir", t }), perigo: true, oculto: !ctx.podeExcluir },
    ];
  }

  const fechar = () => setModal(null);

  const dialogos = modal && (
    <>
      {modal.tipo === "editar" && (
        <TarefaForm ctx={ctx} tarefa={modal.t} aoFechar={fechar} aoSalvar={(t) => { aoMudar(t); fechar(); }} />
      )}

      {modal.tipo === "renomear" && (
        <Dialogo titulo="Renomear tarefa" aoFechar={fechar} largura="sm">
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const titulo = String(new FormData(e.currentTarget).get("titulo") ?? "").trim();
              if (!titulo) return setErro("Dê um nome para a tarefa.");
              if (await salvar(modal.t, { titulo })) fechar();
            }}
          >
            <input name="titulo" autoFocus required maxLength={200} defaultValue={modal.t.titulo} className={campo} aria-label="Nome da tarefa" />
            {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
            <Rodape ocupado={ocupado} aoCancelar={fechar} rotulo="Salvar" />
          </form>
        </Dialogo>
      )}

      {modal.tipo === "responsavel" && (
        <Dialogo titulo="Alterar responsável" aoFechar={fechar} largura="sm">
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get("responsavel") ?? "");
              if (await salvar(modal.t, { responsavel: v || null })) fechar();
            }}
          >
            <select name="responsavel" autoFocus defaultValue={modal.t.responsavel ?? ""} className={campo} aria-label="Responsável">
              <option value="">Sem responsável</option>
              {ctx.membros.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.nome}{m.user_id === ctx.eu ? " (você)" : ""}</option>
              ))}
            </select>
            {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
            <Rodape ocupado={ocupado} aoCancelar={fechar} rotulo="Salvar" />
          </form>
        </Dialogo>
      )}

      {modal.tipo === "status" && (
        <Dialogo titulo="Alterar status" aoFechar={fechar} largura="sm" descricao="Publicado conclui a tarefa e conta 7 dias para o arquivamento automático.">
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const status = new FormData(e.currentTarget).get("status") as Status;
              if (await salvar(modal.t, { status })) fechar();
            }}
          >
            <select name="status" autoFocus defaultValue={modal.t.status} className={campo} aria-label="Status">
              {STATUS_ORDEM.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
            <Rodape ocupado={ocupado} aoCancelar={fechar} rotulo="Salvar" />
          </form>
        </Dialogo>
      )}

      {modal.tipo === "excluir" && (
        <Dialogo
          titulo="Excluir tarefa?"
          aoFechar={fechar}
          largura="sm"
          descricao={<>“{modal.t.titulo}” some de vez, com comentários e histórico. Se quiser só tirar do quadro, use Arquivar.</>}
        >
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={fechar} className={`${botao} border border-line`}>Cancelar</button>
            <button
              type="button"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                const r = await excluirTarefa(modal.t.id);
                setOcupado(false);
                if (r.erro) return setErro(r.erro);
                aoRemover(modal.t.id);
                fechar();
              }}
              className={`${botao} bg-danger font-semibold text-white disabled:opacity-60`}
            >
              {ocupado ? "Excluindo…" : "Excluir definitivamente"}
            </button>
          </div>
        </Dialogo>
      )}
    </>
  );

  return { itensMenu, concluir, reabrir, arquivar, restaurar, editar: (t: Tarefa) => setModal({ tipo: "editar", t }), dialogos, erro, limparErro: () => setErro(null) };
}

function Rodape({ ocupado, aoCancelar, rotulo }: { ocupado: boolean; aoCancelar: () => void; rotulo: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={aoCancelar} className={`${botao} border border-line`}>Cancelar</button>
      <button type="submit" disabled={ocupado} className={botaoPrimario}>{ocupado ? "Salvando…" : rotulo}</button>
    </div>
  );
}
