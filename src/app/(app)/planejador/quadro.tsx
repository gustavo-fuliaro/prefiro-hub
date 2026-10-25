"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { PerfilCurto, PostCurto } from "@/lib/dados-planejador";
import {
  AMBIENTES,
  COLUNAS,
  STATUS_PRODUCAO,
  agruparPorColuna,
  colunaAnterior,
  colunaSeguinte,
  partesSP,
  reordenar,
  type Coluna,
  type Ideia,
} from "@/lib/planejador";
import { moverIdeia } from "./actions";
import { IdeiaDialog } from "./ideia-dialog";

const dataCurta = (iso: string) => {
  const { data, hora } = partesSP(iso);
  const [, m, d] = data.split("-");
  return `${d}/${m} · ${hora}`;
};

export function Quadro({
  perfil,
  ideiasIniciais,
  posts,
  pilares,
  podeEditar,
  abrirIdeia,
  iaLiberada,
}: {
  perfil: PerfilCurto;
  ideiasIniciais: Ideia[];
  posts: PostCurto[];
  pilares: string[];
  podeEditar: boolean;
  abrirIdeia: number | null;
  iaLiberada: boolean;
}) {
  const router = useRouter();
  const [ideias, setIdeias] = useState(ideiasIniciais);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<Coluna | null>(null);
  const [editando, setEditando] = useState<Ideia | "nova" | null>(null);
  const [colunaNova, setColunaNova] = useState<Coluna>("garagem");
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  // Quando o servidor devolve dados novos (após salvar ou recarregar), eles passam a valer.
  useEffect(() => setIdeias(ideiasIniciais), [ideiasIniciais]);

  useEffect(() => {
    if (!abrirIdeia) return;
    const alvo = ideiasIniciais.find((i) => i.id === abrirIdeia);
    if (alvo) setEditando(alvo);
  }, [abrirIdeia, ideiasIniciais]);

  const grupos = agruparPorColuna(ideias);

  function mover(id: number, destino: Coluna, indice: number) {
    const ids = reordenar(grupos[destino].map((i) => i.id), id, indice);
    // Mostra o resultado na hora; o servidor confirma em seguida.
    setIdeias((atual) =>
      atual.map((i) => {
        const pos = ids.indexOf(i.id);
        return i.id === id ? { ...i, coluna: destino, ordem: (pos + 1) * 10 } : pos >= 0 ? { ...i, ordem: (pos + 1) * 10 } : i;
      }),
    );
    setErro(null);
    iniciar(async () => {
      const r = await moverIdeia(id, destino, ids);
      if (r.erro) {
        setErro(r.erro);
        setIdeias(ideiasIniciais);
      }
      router.refresh();
    });
  }

  function soltar(destino: Coluna, indice: number) {
    if (arrastando !== null) mover(arrastando, destino, indice);
    setArrastando(null);
    setSobre(null);
  }

  return (
    <>
      {erro && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {erro}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUNAS.map((col) => {
          const itens = grupos[col.id];
          return (
            <section
              key={col.id}
              aria-label={col.rotulo}
              onDragOver={(e) => {
                if (!podeEditar) return;
                e.preventDefault();
                setSobre(col.id);
              }}
              onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                soltar(col.id, itens.length);
              }}
              className={`flex min-h-48 flex-col gap-3 rounded-xl border bg-surface p-3 ${sobre === col.id ? "border-accent" : "border-line"}`}
            >
              <header className="flex items-baseline justify-between px-1">
                <div>
                  <h2 className="font-display text-lg font-extrabold">{col.rotulo}</h2>
                  <p className="text-xs text-muted">{col.dica}</p>
                </div>
                <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">{itens.length}</span>
              </header>

              <ol className="flex flex-col gap-2">
                {itens.map((ideia, indice) => {
                  const ant = colunaAnterior(ideia.coluna);
                  const seg = colunaSeguinte(ideia.coluna);
                  return (
                    <li
                      key={ideia.id}
                      draggable={podeEditar}
                      onDragStart={(e) => {
                        setArrastando(ideia.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setSobre(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        soltar(col.id, indice);
                      }}
                      onDragOver={(e) => podeEditar && e.preventDefault()}
                      className={`rounded-lg border border-line bg-bg p-3 ${arrastando === ideia.id ? "opacity-40" : ""} ${podeEditar ? "cursor-grab" : ""}`}
                    >
                      <button type="button" onClick={() => setEditando(ideia)} className="block w-full text-left">
                        <span className="block font-semibold leading-snug">{ideia.titulo}</span>
                        {ideia.gancho && <span className="mt-1 line-clamp-2 block text-sm text-muted">{ideia.gancho}</span>}
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                        {ideia.formato && <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">{ideia.formato}</span>}
                        {ideia.pilar && <span className="rounded border border-line px-1.5 py-0.5 text-muted">{ideia.pilar}</span>}
                        {ideia.ambiente && <span className="rounded border border-line px-1.5 py-0.5 text-muted">{AMBIENTES[ideia.ambiente]}</span>}
                        {ideia.status_producao && (
                          <span className="rounded bg-warn-soft px-1.5 py-0.5 text-warn">{STATUS_PRODUCAO[ideia.status_producao]}</span>
                        )}
                        {ideia.publicar_em && <span className="text-muted tabular-nums">{dataCurta(ideia.publicar_em)}</span>}
                        {ideia.post_id && <span className="text-ok">Post ligado</span>}
                      </div>
                      {podeEditar && (
                        <div className="mt-2 flex justify-end gap-1">
                          {ant && (
                            <button
                              type="button"
                              onClick={() => mover(ideia.id, ant, grupos[ant].length)}
                              className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-ink"
                              aria-label={`Voltar "${ideia.titulo}" para ${COLUNAS.find((c) => c.id === ant)?.rotulo}`}
                            >
                              ←
                            </button>
                          )}
                          {seg && (
                            <button
                              type="button"
                              onClick={() => mover(ideia.id, seg, grupos[seg].length)}
                              className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:text-ink"
                              aria-label={`Avançar "${ideia.titulo}" para ${COLUNAS.find((c) => c.id === seg)?.rotulo}`}
                            >
                              →
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              {itens.length === 0 && <p className="px-1 text-sm text-muted">Nenhuma ideia aqui.</p>}

              {podeEditar && (
                <button
                  type="button"
                  onClick={() => {
                    setColunaNova(col.id);
                    setEditando("nova");
                  }}
                  className="mt-auto rounded-lg border border-dashed border-line px-3 py-2 text-sm font-medium text-muted hover:border-accent hover:text-accent"
                >
                  + Nova ideia
                </button>
              )}
            </section>
          );
        })}
      </div>

      {editando && (
        <IdeiaDialog
          ideia={editando === "nova" ? null : editando}
          perfil={perfil}
          colunaInicial={colunaNova}
          posts={posts}
          pilares={pilares}
          podeEditar={podeEditar}
          iaLiberada={iaLiberada}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
