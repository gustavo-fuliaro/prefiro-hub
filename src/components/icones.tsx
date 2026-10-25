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

export const IconeFechar =({ className = "size-4" }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
