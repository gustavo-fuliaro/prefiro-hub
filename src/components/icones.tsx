// Ícones de traço único (2px, pontas arredondadas), desenhados para o Hub.
type P = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconeAnterior = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconeProximo = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconeAbaixo = ({ className = "size-3.5" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconeMais = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconeFechar = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconeSubiu = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

export const IconeCaiu = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

export const IconeLixeira = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </svg>
);

// Ícones dos indicadores do cockpit.
export const IconeIndicador = ({ tipo, className = "size-4" }: P & { tipo: "seguidores" | "views" | "likes" | "comentarios" | "posts_dia" | "engajamento" }) => (
  <svg {...base} className={className}>
    {tipo === "seguidores" && <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>}
    {tipo === "views" && <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>}
    {tipo === "likes" && <path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.6 3.9 4.5 7.1 4.5c2 0 3.4 1.1 4.9 3 1.5-1.9 2.9-3 4.9-3 3.2 0 5.4 3.1 4.3 6.2C19.5 15.4 12 20 12 20z" />}
    {tipo === "comentarios" && <path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.6A8.4 8.4 0 1 1 21 11.5z" />}
    {tipo === "posts_dia" && <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>}
    {tipo === "engajamento" && <path d="M3 12h4l3-8 4 16 3-8h4" />}
  </svg>
);
