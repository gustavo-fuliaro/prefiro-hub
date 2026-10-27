"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconeReticencias } from "@/components/icones";
import { perfilPorId, type PerfilProprio } from "@/lib/perfis-proprios";
import { STATUS_LABEL, type Status } from "@/lib/tarefas";

export type MembroCurto = { user_id: string; nome: string };

// O que toda tela de tarefas precisa saber de quem está usando e do ambiente.
export type Contexto = {
  contaId: number;
  eu: string;
  hoje: string; // AAAA-MM-DD no fuso do ambiente
  fuso: string;
  membros: MembroCurto[];
  podeEditar: boolean; // admin, estrategista, criador
  podeExcluir: boolean; // admin, estrategista
  perfis: PerfilProprio[]; // perfis próprios do ambiente
  perfilAtual: number | null; // null = visão em grupo (todos os perfis)
};

// Etiqueta do perfil da tarefa, mostrada na visão em grupo.
export function EtiquetaPerfil({ ctx, perfilId }: { ctx: Contexto; perfilId: number | null }) {
  const p = perfilPorId(ctx.perfis, perfilId);
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${p ? "bg-accent-soft text-accent-strong" : "bg-lane text-muted"}`}>
      {p ? `@${p.handle}` : "Sem perfil"}
    </span>
  );
}

export const campo = "h-10 w-full rounded-md border border-line bg-bg px-3 font-normal text-ink";
export const botao = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium";
export const botaoPrimario = "inline-flex h-10 items-center gap-1.5 rounded-balao-sm bg-accent px-4 font-semibold text-accent-ink hover:brightness-105 disabled:opacity-60";

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

export function Iniciais({ nome, className = "size-6 text-[11px]" }: { nome: string; className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-rail font-semibold text-rail-ink ${className}`}>
      {iniciais(nome)}
    </span>
  );
}

const COR_STATUS: Record<Status, string> = {
  roteirizacao: "bg-lane text-ink",
  gravacao: "bg-lane text-ink",
  edicao: "bg-lane text-ink",
  pronto: "bg-accent-wash text-accent-strong",
  agendado: "bg-warn-soft text-warn",
  publicado: "bg-ok-soft text-ok",
};

export function ChipStatus({ status }: { status: Status }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR_STATUS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export type ItemMenu = { rotulo: string; acao: () => void; perigo?: boolean; oculto?: boolean };

// Menu "⋯" acessível: abre com clique ou teclado, fecha com Esc ou clique fora.
export function MenuAcoes({ itens, rotulo, className = "" }: { itens: ItemMenu[]; rotulo: string; className?: string }) {
  const [aberto, setAberto] = useState(false);
  // Posição fixa na tela: o menu não pode ficar preso dentro da rolagem horizontal do quadro.
  const [pos, setPos] = useState<React.CSSProperties>({});
  const raiz = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visiveis = itens.filter((i) => !i.oculto);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!raiz.current?.contains(alvo) && !menuRef.current?.contains(alvo)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const fechar = () => setAberto(false);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", fechar);
    window.addEventListener("scroll", fechar, true);
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("scroll", fechar, true);
    };
  }, [aberto]);

  if (!visiveis.length) return null;
  return (
    <div ref={raiz} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={rotulo}
        ref={botaoRef}
        onClick={(e) => {
          e.stopPropagation();
          const r = botaoRef.current?.getBoundingClientRect();
          if (r) {
            const altura = visiveis.length * 37 + 10;
            const cabeAbaixo = r.bottom + 4 + altura <= window.innerHeight;
            setPos({
              position: "fixed",
              right: Math.max(8, window.innerWidth - r.right),
              ...(cabeAbaixo ? { top: r.bottom + 4 } : { bottom: Math.max(8, window.innerHeight - r.top + 4) }),
            });
          }
          setAberto((a) => !a);
        }}
        className="grid size-7 place-items-center rounded-md text-muted hover:bg-lane hover:text-ink"
      >
        <IconeReticencias />
      </button>
      {aberto &&
        createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const lista = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
            const i = lista.indexOf(document.activeElement as HTMLButtonElement);
            lista[(i + (e.key === "ArrowDown" ? 1 : -1) + lista.length) % lista.length]?.focus();
          }}
          style={pos}
          className="menu-acoes z-50 grid min-w-48 gap-0.5 rounded-balao-sm border border-line bg-surface p-1 shadow-float"
        >
          {visiveis.map((i) => (
            <button
              key={i.rotulo}
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                botaoRef.current?.focus();
                i.acao();
              }}
              className={`rounded-md px-3 py-2 text-left text-sm hover:bg-lane focus-visible:bg-lane focus-visible:outline-none ${i.perigo ? "text-danger" : ""}`}
            >
              {i.rotulo}
            </button>
          ))}
        </div>,
          // Dentro de um diálogo aberto, o menu precisa ficar nele (o resto da página fica inerte).
          botaoRef.current?.closest("dialog") ?? document.body,
        )}
    </div>
  );
}
