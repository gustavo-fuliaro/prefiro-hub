import { formatarVariacao } from "@/lib/metricas";

// Número de destaque com a variação em relação ao relatório anterior.
// menorMelhor: queda aparece em verde (ex.: tarefas atrasadas).
export function Kpi({
  rotulo,
  valor,
  delta,
  menorMelhor = false,
  semBase = "sem relatório anterior",
  tom,
}: {
  rotulo: string;
  valor: string;
  delta?: number | null;
  menorMelhor?: boolean;
  semBase?: string;
  tom?: "perigo" | "ok";
}) {
  const bom = delta !== undefined && delta !== null && delta !== 0 && (delta > 0) !== menorMelhor;
  return (
    <div className={`rounded-balao border p-4 shadow-card ${tom === "perigo" ? "border-danger/40 bg-danger-soft" : tom === "ok" ? "border-ok/40 bg-ok-soft" : "border-line bg-surface"}`}>
      <div className="text-sm text-muted">{rotulo}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{valor}</div>
      {delta !== undefined && (
        <div className={`mt-0.5 text-xs tabular-nums ${delta === null || delta === 0 ? "text-muted" : bom ? "text-ok" : "text-danger"}`}>
          {delta === null ? semBase : `${formatarVariacao(delta)} vs. anterior`}
        </div>
      )}
    </div>
  );
}
