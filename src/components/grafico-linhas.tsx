// Gráfico de linhas em SVG (sem biblioteca): uma linha por série, eixo Y em %, eixo X por data.
export type SerieLinha = { id: string; rotulo: string; cor: string; pontos: { dia: string; valor: number }[] };

const W = 760, H = 260, M = { t: 16, r: 16, b: 28, l: 52 };

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(Math.abs(v) < 10 ? 1 : 0).replace(".", ",")}%`;
const fmtDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function escalaBonita(min: number, max: number) {
  if (min === max) { min -= 1; max += 1; }
  const passo = Math.pow(10, Math.floor(Math.log10((max - min) / 4)));
  const mult = [1, 2, 2.5, 5, 10].find((m) => (max - min) / (passo * m) <= 5) ?? 10;
  const p = passo * mult;
  const ini = Math.floor(min / p) * p, fim = Math.ceil(max / p) * p;
  const ticks: number[] = [];
  for (let v = ini; v <= fim + p / 2; v += p) ticks.push(Number(v.toFixed(6)));
  return { ini, fim, ticks };
}

export function GraficoLinhas({ series, titulo }: { series: SerieLinha[]; titulo: string }) {
  const dias = [...new Set(series.flatMap((s) => s.pontos.map((p) => p.dia)))].sort();
  const valores = series.flatMap((s) => s.pontos.map((p) => p.valor));
  if (dias.length < 2 || !valores.length) {
    return <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-sm text-muted">As curvas aparecem quando houver pelo menos dois dias de coleta no período.</p>;
  }
  const { ini, fim, ticks } = escalaBonita(Math.min(0, ...valores), Math.max(0, ...valores));
  const x = (d: string) => M.l + (dias.indexOf(d) / (dias.length - 1)) * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - ini) / (fim - ini)) * (H - M.t - M.b);
  const marcasX = dias.length <= 6 ? dias : [0, 0.25, 0.5, 0.75, 1].map((f) => dias[Math.round(f * (dias.length - 1))]);

  return (
    <figure className="grid gap-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={titulo}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{fmtPct(t)}</text>
            </g>
          ))}
          {[...new Set(marcasX)].map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{fmtDia(d)}</text>
          ))}
          {series.map((s) => {
            const pts = s.pontos.filter((p) => dias.includes(p.dia));
            if (!pts.length) return null;
            const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.dia).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
            const ult = pts.at(-1)!;
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={s.cor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(ult.dia)} cy={y(ult.valor)} r="4" fill={s.cor}>
                  <title>{`${s.rotulo}: ${fmtPct(ult.valor)}`}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-5 rounded-full" style={{ background: s.cor }} aria-hidden="true" />
            {s.rotulo}
            {s.pontos.length > 0 && <span className="tabular-nums text-muted">{fmtPct(s.pontos.at(-1)!.valor)}</span>}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
