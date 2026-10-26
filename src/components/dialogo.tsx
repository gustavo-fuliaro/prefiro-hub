"use client";

import { useEffect, useRef } from "react";
import { IconeFechar } from "@/components/icones";

// Diálogo modal nativo (<dialog>): foco preso, Esc fecha, fundo escurecido. Montado só enquanto aberto.
export function Dialogo({
  titulo,
  descricao,
  aoFechar,
  children,
  largura = "md",
}: {
  titulo: string;
  descricao?: React.ReactNode;
  aoFechar: () => void;
  children: React.ReactNode;
  largura?: "sm" | "md";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      aria-labelledby="dialogo-titulo"
      className={`m-auto ${largura === "sm" ? "w-[min(440px,calc(100vw-32px))]" : "w-[min(560px,calc(100vw-32px))]"} rounded-balao border border-line bg-surface p-0 text-ink`}
    >
      <div className="grid max-h-[85dvh] gap-4 overflow-y-auto p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="dialogo-titulo" className="font-display text-xl font-bold">{titulo}</h2>
            {descricao && <div className="mt-1 text-sm text-muted">{descricao}</div>}
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink" aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
