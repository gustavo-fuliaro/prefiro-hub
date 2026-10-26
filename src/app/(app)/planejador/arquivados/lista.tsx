"use client";

import { useMemo, useState } from "react";
import { IconeBusca } from "@/components/icones";
import { dataCurta, type Tarefa } from "@/lib/tarefas";
import { useAcoesTarefa } from "../acoes";
import { DetalhesTarefa } from "../detalhes";
import { botao, campo, ChipStatus, type Contexto, MenuAcoes } from "../ui";

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ListaArquivados({ ctx, iniciais }: { ctx: Contexto; iniciais: Tarefa[] }) {
  const [tarefas, setTarefas] = useState(iniciais);
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [detalhe, setDetalhe] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Restaurada sai da lista (volta para o quadro); excluída some de vez.
  const mudou = (t: Tarefa) => {
    if (t.arquivada_em) setTarefas((l) => l.map((x) => (x.id === t.id ? t : x)));
    else {
      setTarefas((l) => l.filter((x) => x.id !== t.id));
      setAviso(`“${t.titulo}” voltou para o quadro.`);
    }
  };
  const removida = (id: number) => {
    setTarefas((l) => l.filter((x) => x.id !== id));
    setAviso("Tarefa excluída.");
  };
  const acoes = useAcoesTarefa(ctx, mudou, removida);
  const quando = useMemo(() => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: ctx.fuso }), [ctx.fuso]);
  const diaLocal = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: ctx.fuso }), [ctx.fuso]);

  const termo = normalizar(busca.trim());
  const visiveis = tarefas.filter((t) => {
    const dia = diaLocal.format(new Date(t.arquivada_em!));
    return (!termo || normalizar(t.titulo).includes(termo)) && (!de || dia >= de) && (!ate || dia <= ate);
  });
  const nomes = new Map(ctx.membros.map((m) => [m.user_id, m.nome]));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar arquivada</span>
          <IconeBusca className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" className={`${campo} bg-surface pl-9`} />
        </label>
        <fieldset className="flex items-center gap-1.5 text-sm text-muted">
          <legend className="sr-only">Período de arquivamento</legend>
          <span aria-hidden>Arquivadas de</span>
          <input type="date" aria-label="De" value={de} onChange={(e) => setDe(e.target.value)} className="h-10 rounded-md border border-line bg-surface px-2.5" />
          <span aria-hidden>a</span>
          <input type="date" aria-label="Até" value={ate} onChange={(e) => setAte(e.target.value)} className="h-10 rounded-md border border-line bg-surface px-2.5" />
        </fieldset>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm">
        {acoes.erro ? <span className="text-danger">{acoes.erro}</span> : aviso ? <span className="text-ok">{aviso}</span> : (
          <span className="text-muted">{visiveis.length} de {tarefas.length} arquivadas</span>
        )}
      </p>

      {visiveis.length === 0 ? (
        <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-muted">
          {tarefas.length ? "Nenhuma arquivada com estes filtros." : "Nenhuma tarefa arquivada ainda."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {visiveis.map((t) => (
            <li key={t.id} className="grid gap-3 rounded-balao border border-line bg-surface p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="grid min-w-0 gap-1">
                <button type="button" onClick={() => setDetalhe(t.id)} className="truncate text-left font-semibold hover:text-accent-strong">
                  {t.titulo}
                </button>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <ChipStatus status={t.status} />
                  <span>{t.arquivada_auto ? "Arquivada automaticamente" : "Arquivada"} em {quando.format(new Date(t.arquivada_em!))}</span>
                  {t.data_publicacao && <span>Publicação {dataCurta(t.data_publicacao)}</span>}
                  <span>{t.responsavel ? (nomes.get(t.responsavel) ?? "Pessoa removida") : "Sem responsável"}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setDetalhe(t.id)} className={`${botao} border border-line hover:border-accent`}>Detalhes</button>
                {ctx.podeEditar && (
                  <button type="button" onClick={() => acoes.restaurar(t)} className={`${botao} border border-line hover:border-accent`}>Restaurar</button>
                )}
                <MenuAcoes rotulo={`Ações de ${t.titulo}`} itens={acoes.itensMenu(t, { abrir: () => setDetalhe(t.id) })} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {detalhe !== null && (
        <DetalhesTarefa
          key={detalhe}
          ctx={ctx}
          tarefaId={detalhe}
          tarefa={tarefas.find((t) => t.id === detalhe)}
          aoMudar={mudou}
          aoRemover={removida}
          aoFechar={() => setDetalhe(null)}
        />
      )}
      {acoes.dialogos}
    </div>
  );
}
