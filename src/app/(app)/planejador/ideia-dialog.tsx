"use client";

import Link from "next/link";
import { IconeFechar } from "@/components/icones";
import { useEffect, useRef, useState, useTransition } from "react";
import type { PerfilCurto, PostCurto } from "@/lib/dados-planejador";
import { AMBIENTES, COLUNAS, FORMATOS, STATUS_PRODUCAO, partesSP, type Coluna, type Ideia } from "@/lib/planejador";
import { excluirIdeia, salvarIdeia } from "./actions";

const campo = "rounded-md border border-line bg-bg px-3 py-2 font-normal disabled:opacity-70";
const rotulo = "grid gap-1 text-sm font-medium";

const dataPost = (iso: string | null) => (iso ? partesSP(iso).data.split("-").reverse().join("/") : "");

export function IdeiaDialog({
  ideia,
  perfil,
  colunaInicial,
  posts,
  pilares,
  podeEditar,
  iaLiberada,
  aoFechar,
  aoSalvar,
}: {
  ideia: Ideia | null;
  perfil: PerfilCurto;
  colunaInicial: Coluna;
  posts: PostCurto[];
  pilares: string[];
  podeEditar: boolean;
  iaLiberada: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [pendente, iniciar] = useTransition();
  const quando = ideia?.publicar_em ? partesSP(ideia.publicar_em) : { data: "", hora: "" };

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function enviar(fd: FormData) {
    setErro(null);
    iniciar(async () => {
      const r = await salvarIdeia(fd);
      if (r.erro) setErro(r.erro);
      else aoSalvar();
    });
  }

  function excluir() {
    if (!ideia) return;
    iniciar(async () => {
      const r = await excluirIdeia(ideia.id);
      if (r.erro) setErro(r.erro);
      else aoSalvar();
    });
  }

  const somenteLeitura = !podeEditar;

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="m-auto w-[min(720px,calc(100vw-32px))] rounded-balao border border-line bg-surface p-0 text-ink backdrop:bg-black/50 shadow-card"
    >
      <form action={enviar} className="grid max-h-[85dvh] gap-4 overflow-y-auto p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{ideia ? "Editar ideia" : "Nova ideia"}</h2>
            <p className="mt-0.5 text-sm text-muted">@{perfil.handle}</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="grid size-9 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink" aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>

        <input type="hidden" name="perfil_id" value={perfil.id} />
        {ideia && <input type="hidden" name="id" value={ideia.id} />}

        <fieldset disabled={somenteLeitura || pendente} className="grid gap-4">
          <label className={rotulo}>
            Título *
            <input id="titulo" name="titulo" required maxLength={200} defaultValue={ideia?.titulo ?? ""} className={campo} autoFocus />
          </label>
          <label className={rotulo}>
            Gancho (primeiros segundos)
            <textarea id="gancho" name="gancho" rows={2} maxLength={500} defaultValue={ideia?.gancho ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            Tese ou roteiro resumido
            <textarea id="tese" name="tese" rows={4} maxLength={2000} defaultValue={ideia?.tese ?? ""} className={campo} />
          </label>
          <label className={rotulo}>
            Chamada para ação (CTA)
            <input id="cta" name="cta" maxLength={300} defaultValue={ideia?.cta ?? ""} className={campo} />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className={rotulo}>
              Coluna
              <select id="coluna" name="coluna" defaultValue={ideia?.coluna ?? colunaInicial} className={campo}>
                {COLUNAS.map((c) => (
                  <option key={c.id} value={c.id}>{c.rotulo}</option>
                ))}
              </select>
            </label>
            <label className={rotulo}>
              Formato
              <select id="formato" name="formato" defaultValue={ideia?.formato ?? ""} className={campo}>
                <option value="">—</option>
                {FORMATOS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
                {ideia?.formato && !FORMATOS.includes(ideia.formato as (typeof FORMATOS)[number]) && (
                  <option value={ideia.formato}>{ideia.formato}</option>
                )}
              </select>
            </label>
            <label className={rotulo}>
              Pilar
              <input id="pilar" name="pilar" list="pilares" maxLength={60} defaultValue={ideia?.pilar ?? ""} className={campo} placeholder="Ex.: Autoridade" />
              <datalist id="pilares">
                {pilares.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={rotulo}>
              Onde gravar
              <select id="ambiente" name="ambiente" defaultValue={ideia?.ambiente ?? ""} className={campo}>
                <option value="">—</option>
                {Object.entries(AMBIENTES).map(([v, r]) => (
                  <option key={v} value={v}>{r}</option>
                ))}
              </select>
            </label>
            <label className={rotulo}>
              Etapa da produção
              <select id="status_producao" name="status_producao" defaultValue={ideia?.status_producao ?? ""} className={campo}>
                <option value="">—</option>
                {Object.entries(STATUS_PRODUCAO).map(([v, r]) => (
                  <option key={v} value={v}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={rotulo}>
              Data de postagem
              <input id="data" name="data" type="date" defaultValue={quando.data} className={campo} />
            </label>
            <label className={rotulo}>
              Horário (Brasília)
              <input id="hora" name="hora" type="time" defaultValue={quando.hora} className={campo} />
            </label>
          </div>

          <label className={rotulo}>
            Referências (um link por linha)
            <textarea id="referencias" name="referencias" rows={2} defaultValue={(ideia?.referencias ?? []).join("\n")} className={campo} placeholder="https://www.instagram.com/reel/..." />
          </label>

          <label className={rotulo}>
            Post publicado (para medir o resultado)
            <select id="post_id" name="post_id" defaultValue={ideia?.post_id ?? ""} className={campo}>
              <option value="">Ainda não publicado</option>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {dataPost(p.publicado_em)} · {(p.legenda ?? "Sem legenda").slice(0, 70)}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        {erro && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            {ideia && podeEditar && !confirmarExclusao && (
              <button type="button" onClick={() => setConfirmarExclusao(true)} className="text-sm text-danger hover:underline">
                Excluir ideia
              </button>
            )}
            {confirmarExclusao && (
              <span className="flex items-center gap-2 text-sm">
                Excluir de vez?
                <button type="button" onClick={excluir} disabled={pendente} className="rounded-md bg-danger px-3 py-1 font-semibold text-surface">
                  Sim, excluir
                </button>
                <button type="button" onClick={() => setConfirmarExclusao(false)} className="text-muted hover:underline">
                  Cancelar
                </button>
              </span>
            )}
            {ideia && (
              <Link href={`/briefings?perfil=${perfil.handle}#ideia-${ideia.id}`} className="text-sm text-accent-strong hover:underline">
                Abrir briefing
              </Link>
            )}
            {ideia && podeEditar && iaLiberada && (
              <Link href={`/estudio?perfil=${perfil.handle}&tipo=roteiro&ideia=${ideia.id}`} className="text-sm text-accent-strong hover:underline">
                Roteiro com IA
              </Link>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded-md border border-line px-4 py-2 text-sm">
              {somenteLeitura ? "Fechar" : "Cancelar"}
            </button>
            {!somenteLeitura && (
              <button type="submit" disabled={pendente} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
                {pendente ? "Salvando…" : "Salvar"}
              </button>
            )}
          </div>
        </footer>
      </form>
    </dialog>
  );
}
