"use client";

import { useId, useState } from "react";
import type { BarraPost } from "@/lib/evolucao";

// Colunas de uma métrica para os últimos posts (um eixo só). Valor do maior post sempre visível;
// os demais aparecem ao passar o mouse ou focar com o teclado. Sem dado, a coluna vira um traço com o motivo.
type Chave = "likes" | "comentarios" | "views";

const W = 640, H = 188, M = { t: 22, r: 8, b: 26, l: 40 };
const inteiro = new Intl.NumberFormat("pt-BR");
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (v: number) => (Math.abs(v) >= 10_000 ? compacto.format(v) : inteiro.format(v));

function teto(max: number) {
  if (max <= 0) return { fim: 1, ticks: [0, 1] };
  const passo = Math.pow(10, Math.floor(Math.log10(max / 2)));
  const p = [1, 2, 2.5, 5, 10].map((m) => m * passo).find((x) => max / x <= 3) ?? 10 * passo;
  const fim = Math.ceil(max / p) * p;
  const ticks: number[] = [];
  for (let v = 0; v <= fim + p / 2; v += p) ticks.push(v);
  return { fim, ticks };
}

export function GraficoColunas({ titulo, chave, posts, semDado }: { titulo: string; chave: Chave; posts: BarraPost[]; semDado: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const id = useId();
  const valores = posts.map((p) => p[chave]);
  const lidos = valores.filter((v): v is number => v !== null);

  if (lidos.length === 0) {
    return (
      <figure className="grid gap-2">
        <figcaption className="text-sm font-semibold">{titulo}</figcaption>
        <p className="rounded-balao-sm border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{semDado}</p>
      </figure>
    );
  }

  const max = Math.max(...lidos);
  const { fim, ticks } = teto(max);
  const n = posts.length;
  const larguraFaixa = (W - M.l - M.r) / n;
  const larguraBarra = Math.min(44, larguraFaixa * 0.62);
  const x = (i: number) => M.l + i * larguraFaixa + (larguraFaixa - larguraBarra) / 2;
  const y = (v: number) => M.t + (1 - v / fim) * (H - M.t - M.b);
  const base = H - M.b;
  const iMax = valores.indexOf(max);
  const sel = ativo !== null ? posts[ativo] : null;

  return (
    <figure className="relative grid gap-2" onMouseLeave={() => setAtivo(null)}>
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{titulo}</span>
        <span className="text-xs text-muted">Maior: {fmt(max)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{`${titulo} dos últimos ${n} posts. Maior valor: ${fmt(max)}.`}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{fmt(t)}</text>
          </g>
        ))}
        {posts.map((p, i) => {
          const v = valores[i];
          const realce = ativo === i;
          // Valores muito pequenos ainda aparecem: a coluna tem no mínimo 4px de altura.
          const topo = v === null ? base : Math.min(y(v), base - 4);
          return (
            <g
              key={p.id}
              tabIndex={0}
              role="button"
              aria-label={`${p.rotulo}, ${p.formato}: ${v === null ? "sem dado" : `${inteiro.format(v)}`}`}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className="cursor-default outline-none"
            >
              {/* Alvo de toque maior que a coluna. */}
              <rect x={M.l + i * larguraFaixa} y={M.t} width={larguraFaixa} height={base - M.t} fill="transparent" />
              {realce && <rect x={M.l + i * larguraFaixa + 2} y={M.t} width={larguraFaixa - 4} height={base - M.t} rx="6" fill="var(--accent-wash)" />}
              {v === null ? (
                <line x1={x(i) + 6} x2={x(i) + larguraBarra - 6} y1={base - 3} y2={base - 3} stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
              ) : (
                <path
                  d={`M${x(i)},${base} V${topo + 4} Q${x(i)},${topo} ${x(i) + 4},${topo} H${x(i) + larguraBarra - 4} Q${x(i) + larguraBarra},${topo} ${x(i) + larguraBarra},${topo + 4} V${base} Z`}
                  fill="var(--serie-1)"
                  opacity={ativo === null || realce ? 1 : 0.55}
                />
              )}
              {v !== null && (i === iMax || realce) && (
                <text x={x(i) + larguraBarra / 2} y={topo - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">{fmt(v)}</text>
              )}
              <text x={x(i) + larguraBarra / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={realce ? "var(--ink)" : "var(--muted)"}>{p.rotulo}</text>
            </g>
          );
        })}
      </svg>
      {sel && (
        <div className="pointer-events-none absolute left-1/2 top-8 z-10 w-64 -translate-x-1/2 rounded-balao-sm border border-line bg-surface p-3 text-xs shadow-float">
          <div className="font-semibold">{sel.rotulo} · {sel.formato}</div>
          <div className="mt-0.5 tabular-nums">
            {sel[chave] === null
              ? chave === "views" ? "Sem views: a Meta só informa views de Reels." : "Sem dado para este post."
              : `${titulo}: ${inteiro.format(sel[chave] as number)}`}
          </div>
          {sel.legenda && <p className="mt-1 line-clamp-2 text-muted">{sel.legenda}</p>}
        </div>
      )}
    </figure>
  );
}
