import { caminhoSparkline, type Farol } from "@/lib/metricas";

const COR: Record<Farol, string> = { verde: "var(--ok)", amarelo: "var(--warn)", vermelho: "var(--danger)" };

export function Sparkline({ valores, farol, rotulo }: { valores: number[]; farol: Farol; rotulo: string }) {
  const w = 280, h = 64;
  const { linha, area, ultimo } = caminhoSparkline(valores, w, h);
  const id = rotulo.replace(/\W+/g, "-");
  if (!linha) return <div className="h-16 text-xs text-muted">Sem pontos no período.</div>;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full overflow-visible" role="img" aria-label={rotulo} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COR[farol]} stopOpacity="0.28" />
          <stop offset="100%" stopColor={COR[farol]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="var(--line)" strokeDasharray="3 4" />
      <path d={area} fill={`url(#g-${id})`} />
      <path d={linha} fill="none" stroke={COR[farol]} strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {ultimo && <circle cx={ultimo.x} cy={ultimo.y} r="3.5" fill={COR[farol]} />}
    </svg>
  );
}
