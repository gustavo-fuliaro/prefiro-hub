"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { marcarLida, marcarTodasLidas } from "./notificacoes-actions";

export type Notificacao = {
  id: number;
  tipo: string;
  mensagem: string;
  severidade: "info" | "atencao" | "critico";
  link: string | null;
  lido: boolean;
  criado_em: string;
};

const TIPO: Record<string, string> = {
  queda_seguidores: "Queda de seguidores",
  post_destaque: "Post em destaque",
  meta_em_risco: "Meta fora do ritmo",
  coleta_erro: "Falha na coleta",
  relatorio_semanal: "Relatório semanal",
};
const PONTO: Record<Notificacao["severidade"], string> = { critico: "bg-danger", atencao: "bg-warn", info: "bg-accent" };
const quando = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Sino({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// Sino do cabeçalho: contador de não lidas e painel com os alertas da conta, do mais recente ao mais antigo.
export function Notificacoes({ itens, naoLidas, variante = "claro" }: { itens: Notificacao[]; naoLidas: number; variante?: "claro" | "trilho" }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState(itens);
  const [, iniciar] = useTransition();
  const raiz = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const idPainel = useId();

  // Dados novos do servidor (depois de uma ação ou navegação) passam a valer.
  useEffect(() => setLista(itens), [itens]);

  useEffect(() => {
    if (!aberto) return;
    titulo.current?.focus();
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const pendentes = lista.filter((n) => !n.lido).length;
  // O servidor conta todas as não lidas; descontamos as que a pessoa acabou de marcar aqui.
  const contador = Math.max(0, naoLidas - (itens.filter((n) => !n.lido).length - pendentes));

  function alternar(n: Notificacao) {
    setLista((l) => l.map((x) => (x.id === n.id ? { ...x, lido: !x.lido } : x)));
    iniciar(() => marcarLida(n.id, !n.lido));
  }
  function lerTudo() {
    setLista((l) => l.map((x) => ({ ...x, lido: true })));
    iniciar(() => marcarTodasLidas());
  }

  const botao =
    variante === "trilho"
      ? "text-rail-ink hover:bg-rail-hover"
      : "border border-line bg-surface text-ink shadow-card hover:border-accent";

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-label={contador ? `Notificações: ${contador} não lidas` : "Notificações"}
        className={`relative grid size-10 place-items-center rounded-balao-sm ${botao}`}
      >
        <Sino />
        {contador > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] leading-5 font-bold text-white tabular-nums">
            {contador > 99 ? "99+" : contador}
          </span>
        )}
      </button>

      {aberto && (
        <div
          id={idPainel}
          role="dialog"
          aria-label="Notificações"
          className="painel-notificacoes absolute right-0 top-12 z-40 w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-balao border border-line bg-surface text-ink shadow-float"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 ref={titulo} tabIndex={-1} className="font-display text-base font-bold outline-none">
              Notificações
            </h2>
            {pendentes > 0 && (
              <button type="button" onClick={lerTudo} className="text-sm font-medium text-accent-strong hover:underline">
                Marcar todas como lidas
              </button>
            )}
          </header>

          {lista.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="max-h-[min(70vh,520px)] divide-y divide-line overflow-y-auto">
              {lista.map((n) => (
                <li key={n.id} className={`grid gap-1 px-4 py-3 ${n.lido ? "" : "bg-accent-wash"}`}>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span aria-hidden className={`size-2 shrink-0 rounded-full ${n.lido ? "bg-line-strong" : PONTO[n.severidade]}`} />
                    <span className="font-semibold">{TIPO[n.tipo] ?? n.tipo}</span>
                    <span className="tabular-nums">{quando.format(new Date(n.criado_em))}</span>
                    <span className="sr-only">{n.lido ? "lida" : "não lida"}</span>
                  </div>
                  <p className={`text-sm ${n.lido ? "text-muted" : "font-medium"}`}>{n.mensagem}</p>
                  <div className="flex items-center gap-4 text-sm">
                    {n.link &&
                      (n.link.startsWith("/") ? (
                        <Link href={n.link} onClick={() => setAberto(false)} className="text-accent-strong hover:underline">
                          Abrir
                        </Link>
                      ) : (
                        <a href={n.link} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">
                          Abrir post
                        </a>
                      ))}
                    <button type="button" onClick={() => alternar(n)} className="text-muted hover:text-ink">
                      {n.lido ? "Marcar como não lida" : "Marcar como lida"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
