import { IconeCaiu, IconeIndicador, IconeSubiu } from "@/components/icones";
import { Sparkline } from "@/components/sparkline";
import type { Indicador } from "@/lib/evolucao";
import { farol, formatarNumero, formatarPct, formatarVariacao, type Farol } from "@/lib/metricas";

const COR: Record<Farol, string> = { verde: "text-ok", amarelo: "text-muted", vermelho: "text-danger" };
const virgula = (n: number, casas: number) => n.toFixed(casas).replace(".", ",");

// Tendência: % para contagens; para taxas (engajamento, posts/dia), o sinal da variação absoluta.
function tendencia(i: Indicador): Farol {
  if (i.delta === null) return "amarelo";
  if (i.chave === "engajamento") return i.delta > 0.01 ? "verde" : i.delta < -0.01 ? "vermelho" : "amarelo";
  if (i.chave === "posts_dia") return "amarelo";
  return farol(i.pct);
}

function valores(i: Indicador): { grande: string; extra: string | null; sub: string } {
  const de = (a: string, b: string) => `${a} → ${b}`;
  if (i.chave === "posts_dia") {
    return {
      grande: i.delta === null ? "—" : `${virgula(i.delta, 1)}/dia`,
      extra: null,
      sub: i.inicio !== null && i.fim !== null ? de(formatarNumero(i.inicio), `${formatarNumero(i.fim)} posts`) : "Sem leitura do total de posts.",
    };
  }
  if (i.chave === "engajamento") {
    return {
      grande: i.delta === null ? (i.fim !== null ? formatarPct(i.fim, 2) : "—") : `${i.delta > 0 ? "+" : i.delta < 0 ? "−" : ""}${virgula(Math.abs(i.delta), 2)} p.p.`,
      extra: null,
      sub: i.delta !== null ? de(formatarPct(i.inicio, 2), formatarPct(i.fim, 2)) : i.fim !== null ? "Valor atual" : "Sem leituras no período.",
    };
  }
  if (i.delta === null) {
    return { grande: formatarNumero(i.fim), extra: null, sub: i.fim !== null ? "Valor atual" : "Sem leituras no período." };
  }
  return {
    grande: formatarVariacao(i.delta),
    // Variações muito pequenas (seguidores de perfis grandes) ganham uma casa a mais para não virar "+0,0%".
    extra: i.pct !== null ? `${i.pct > 0 ? "+" : ""}${formatarPct(i.pct, Math.abs(i.pct) < 0.1 && i.pct !== 0 ? 2 : 1)}` : null,
    sub: de(formatarNumero(i.inicio), formatarNumero(i.fim)),
  };
}

// Estado informativo quando não há dado suficiente: diz por quê, sem gráfico vazio nem número inventado.
function aviso(i: Indicador): string | null {
  if (i.leituras === 0) {
    return i.chave === "views"
      ? "Sem views no período. A Meta só informa views de Reels, e a coleta passou a registrá-las em 26/10/2026."
      : "Ainda sem leituras neste período.";
  }
  if (i.leituras === 1) return "Só uma leitura até agora. A variação e a curva aparecem a partir da próxima coleta.";
  return null;
}

export function CartaoIndicador({ i }: { i: Indicador }) {
  const t = tendencia(i);
  const v = valores(i);
  const a = aviso(i);
  return (
    <article className={`grid content-start gap-2 rounded-balao border bg-surface p-4 shadow-card ${i.principal ? "border-accent" : "border-line"}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="grid size-7 place-items-center rounded-balao-sm bg-accent-wash text-accent-strong"><IconeIndicador tipo={i.chave} /></span>
          {i.titulo}
        </h3>
        {i.principal && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">Métrica principal</span>}
      </header>
      <div className={`flex items-baseline gap-2 ${COR[t]}`}>
        {i.delta !== null && i.delta !== 0 && t !== "amarelo" && (i.delta > 0 ? <IconeSubiu className="size-5 self-center" /> : <IconeCaiu className="size-5 self-center" />)}
        <span className="font-display text-3xl font-bold tabular-nums">{v.grande}</span>
        {v.extra && <span className="text-sm font-semibold tabular-nums">{v.extra}</span>}
      </div>
      <div className="text-sm text-muted tabular-nums">{v.sub}</div>
      {a ? (
        <p className="rounded-balao-sm bg-bg px-3 py-2 text-xs text-muted">{a}</p>
      ) : (
        <Sparkline valores={i.serie} farol={t} rotulo={`Evolução de ${i.titulo}`} />
      )}
      <p className="text-xs text-muted">{i.nota}</p>
    </article>
  );
}
