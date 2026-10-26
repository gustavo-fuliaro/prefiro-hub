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

export const IconeCadeado = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconeCheck = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const IconeLapis = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

export const IconeArquivar = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </svg>
);

export const IconeRestaurar = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
  </svg>
);

export const IconeReticencias = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />
  </svg>
);

export const IconeComentario = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M4 5h16v11H9l-5 4V5z" />
  </svg>
);

export const IconeCalendario = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </svg>
);

export const IconeRelogio = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 2.5" />
  </svg>
);

export const IconeLink = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);

export const IconeBusca = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);

export const IconePessoa = ({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
);
