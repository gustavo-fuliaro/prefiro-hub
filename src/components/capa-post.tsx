"use client";

import { useState } from "react";

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function IconeFormato({ formato }: { formato: string }) {
  if (formato === "Reel")
    return (
      <svg {...base} className="size-8">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" />
      </svg>
    );
  if (formato === "Carrossel")
    return (
      <svg {...base} className="size-8">
        <rect x="7" y="3" width="14" height="14" rx="3" />
        <path d="M3 7v11a3 3 0 0 0 3 3h11" />
      </svg>
    );
  return (
    <svg {...base} className="size-8">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L6 21" />
    </svg>
  );
}

// Capa do post guardada no Storage. Sem capa (ou se a imagem falhar), mostra o formato e um convite
// para abrir no Instagram, em vez de um quadro vazio.
export function CapaPost({ src, formato, className = "" }: { src: string | null; formato: string; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const mostrarImagem = !!src && !falhou;
  return (
    <div className={`relative grid place-items-center overflow-hidden bg-lane text-muted ${className}`}>
      {!mostrarImagem && (
        <div className="grid justify-items-center gap-1.5 px-3 text-center">
          <IconeFormato formato={formato} />
          <span className="text-xs">Ver no Instagram</span>
        </div>
      )}
      {mostrarImagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFalhou(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}
