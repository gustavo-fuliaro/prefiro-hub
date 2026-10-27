"use client";

import { useState } from "react";
import { Dialogo } from "@/components/dialogo";
import { perfilPadrao } from "@/lib/perfis-proprios";
import { criarTarefa, atualizarTarefa } from "@/lib/tarefas-api";
import { lerData, lerLink, STATUS_LABEL, STATUS_ORDEM, type Status, type Tarefa } from "@/lib/tarefas";
import { botao, botaoPrimario, campo, type Contexto } from "./ui";

// Formulário de nova tarefa e de edição. Só o nome é obrigatório.
export function TarefaForm({
  ctx,
  tarefa,
  statusInicial = "roteirizacao",
  ordem,
  aoSalvar,
  aoFechar,
}: {
  ctx: Contexto;
  tarefa?: Tarefa;
  statusInicial?: Status;
  ordem?: number;
  aoSalvar: (t: Tarefa) => void;
  aoFechar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const nova = !tarefa;

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") ?? "").trim();
    if (!titulo) return setErro("Dê um nome para a tarefa.");
    if (titulo.length > 200) return setErro("O nome pode ter até 200 caracteres.");
    const linkRoteiro = lerLink(fd.get("link_roteiro"));
    const linkDrive = lerLink(fd.get("link_drive"));
    if (linkRoteiro === false || linkDrive === false) return setErro("Os links precisam começar com http:// ou https://.");
    const vencimento = lerData(fd.get("vencimento"));
    const publicacao = lerData(fd.get("data_publicacao"));
    if (vencimento === false || publicacao === false) return setErro("Confira as datas.");
    const responsavel = String(fd.get("responsavel") ?? "") || null;
    const perfil = Number(fd.get("perfil_id")) || null;

    const dados: Partial<Tarefa> = {
      titulo,
      status: fd.get("status") as Status,
      responsavel,
      perfil_id: perfil,
      vencimento,
      link_roteiro: linkRoteiro,
      link_drive: linkDrive,
      data_publicacao: publicacao,
      ...(nova && ordem !== undefined ? { ordem } : {}),
    };
    setErro(null);
    setSalvando(true);
    const r = nova ? await criarTarefa(dados) : await atualizarTarefa(tarefa.id, dados);
    setSalvando(false);
    if (r.erro) return setErro(r.erro);
    aoSalvar(r.ok!);
  }

  return (
    <Dialogo titulo={nova ? "Nova tarefa" : "Editar tarefa"} aoFechar={aoFechar} descricao={nova ? "Só o nome é obrigatório. O resto dá para completar depois." : undefined}>
      <form onSubmit={enviar} className="grid gap-4" noValidate>
        <label className="grid gap-1 text-sm font-medium">
          Nome da tarefa
          <input name="titulo" required maxLength={200} autoFocus defaultValue={tarefa?.titulo} className={campo} placeholder="Ex.: Reel sobre carta contemplada" />
        </label>
        {ctx.perfis.length > 0 && (
          <label className="grid gap-1 text-sm font-medium">
            Perfil
            <select name="perfil_id" defaultValue={String((tarefa ? tarefa.perfil_id : perfilPadrao(ctx.perfis, ctx.perfilAtual)) ?? "")} className={campo}>
              <option value="">Sem perfil</option>
              {ctx.perfis.map((p) => (
                <option key={p.id} value={p.id}>@{p.handle}</option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Status
            <select name="status" defaultValue={tarefa?.status ?? statusInicial} className={campo}>
              {STATUS_ORDEM.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Responsável
            <select name="responsavel" defaultValue={tarefa?.responsavel ?? ""} className={campo}>
              <option value="">Sem responsável</option>
              {ctx.membros.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.nome}{m.user_id === ctx.eu ? " (você)" : ""}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Data da tarefa
            <input name="vencimento" type="date" defaultValue={tarefa?.vencimento ?? ""} className={campo} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Data da publicação
            <input name="data_publicacao" type="date" defaultValue={tarefa?.data_publicacao ?? ""} className={campo} />
          </label>
        </div>
        <label className="grid gap-1 text-sm font-medium">
          Link do roteiro
          <input name="link_roteiro" type="url" inputMode="url" defaultValue={tarefa?.link_roteiro ?? ""} className={campo} placeholder="https://" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Link do Drive
          <input name="link_drive" type="url" inputMode="url" defaultValue={tarefa?.link_drive ?? ""} className={campo} placeholder="https://drive.google.com/…" />
        </label>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className={`${botao} border border-line`}>Cancelar</button>
          <button type="submit" disabled={salvando} className={botaoPrimario}>
            {salvando ? "Salvando…" : nova ? "Criar tarefa" : "Salvar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
