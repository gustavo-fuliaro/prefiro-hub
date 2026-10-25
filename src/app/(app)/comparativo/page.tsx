import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { IconeAbaixo } from "@/components/icones";
import { Estrela } from "@/components/marca";
import { GraficoLinhas, type SerieLinha } from "@/components/grafico-linhas";
import { crescimentoAcumulado, participacoes, resumir } from "@/lib/comparativo";
import { carregarComparativo, diasAtras, hojeSP } from "@/lib/dados-comparativo";
import { formatarNumero, formatarPct, formatarVariacao } from "@/lib/metricas";
import { GRUPOS, type Grupo } from "@/lib/perfis";

export const metadata: Metadata = { title: "Comparativo" };

const PERIODOS = [
  { v: "7", r: "7 dias" },
  { v: "30", r: "30 dias" },
  { v: "90", r: "90 dias" },
] as const;

const ESCOPOS: { v: string; r: string; grupos: Grupo[] }[] = [
  { v: "proprios", r: "Perfis próprios", grupos: ["proprio"] },
  { v: "todos", r: "Todos os perfis", grupos: ["proprio", "time", "parceiro", "concorrente"] },
];

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

export default async function ComparativoPage({ searchParams }: { searchParams: Promise<{ periodo?: string; escopo?: string; ordem?: string }> }) {
  const busca = await searchParams;
  const periodo = PERIODOS.find((p) => p.v === busca.periodo)?.v ?? "30";
  const escopo = ESCOPOS.find((e) => e.v === busca.escopo) ?? ESCOPOS[0];
  const hoje = hojeSP();
  const { perfis, snapshots, interacoes } = await carregarComparativo({ grupos: escopo.grupos, desde: diasAtras(hoje, Number(periodo)) });

  const resumos = perfis.map((p) =>
    resumir(p.id, snapshots.filter((s) => s.perfil_id === p.id), interacoes.get(p.id) ?? null),
  );
  const parts = participacoes(resumos);
  const porId = new Map(perfis.map((p) => [p.id, p]));

  const ORDENS = {
    crescimento: (r: (typeof resumos)[number]) => r.crescimentoPct ?? -Infinity,
    ganho: (r: (typeof resumos)[number]) => r.ganho ?? -Infinity,
    seguidores: (r: (typeof resumos)[number]) => r.seguidoresFim ?? -Infinity,
    engajamento: (r: (typeof resumos)[number]) => r.engajamentoPct ?? -Infinity,
  };
  const ordem = (Object.keys(ORDENS) as (keyof typeof ORDENS)[]).find((k) => k === busca.ordem) ?? "crescimento";
  const ranking = [...resumos].sort((a, b) => ORDENS[ordem](b) - ORDENS[ordem](a));

  const series: SerieLinha[] = ranking.slice(0, 6).map((r, i) => ({
    id: String(r.perfil_id),
    rotulo: `@${porId.get(r.perfil_id)!.handle}`,
    cor: `var(--serie-${i + 1})`,
    pontos: crescimentoAcumulado(snapshots.filter((s) => s.perfil_id === r.perfil_id)).map((p) => ({ dia: p.dia, valor: p.pct })),
  }));

  const totalSeguidores = resumos.reduce((s, r) => s + (r.seguidoresFim ?? 0), 0);
  const totalGanho = resumos.reduce((s, r) => s + (r.ganho ?? 0), 0);
  const link = (extra: Record<string, string>) => `/comparativo?${new URLSearchParams({ periodo, escopo: escopo.v, ordem, ...extra })}`;
  const temConcorrentes = escopo.grupos.includes("concorrente") && perfis.some((p) => p.grupo === "concorrente");

  const Th = ({ campo, children }: { campo: keyof typeof ORDENS; children: React.ReactNode }) => (
    <th className="px-4 py-3 text-right font-semibold">
      <Link href={link({ ordem: campo })} className={`inline-flex items-center justify-end gap-1 ${ordem === campo ? "text-accent-strong" : "hover:text-ink"}`} aria-current={ordem === campo ? "true" : undefined}>
        {children}
        {ordem === campo && <IconeAbaixo />}
      </Link>
    </th>
  );

  return (
    <div className="grid max-w-6xl gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Comparativo</h1>
          <p className="mt-1 text-muted">
            {temConcorrentes
              ? "Ranking e participação de mercado entre os perfis monitorados."
              : "Ranking e participação de cada perfil no total da Prefiro. Com concorrentes cadastrados, vira market share."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[ESCOPOS.map((e) => ({ v: e.v, r: e.r, ativo: e.v === escopo.v, href: link({ escopo: e.v }) })),
            PERIODOS.map((p) => ({ v: p.v, r: p.r, ativo: p.v === periodo, href: link({ periodo: p.v }) }))].map((grupo, gi) => (
            <nav key={gi} aria-label={gi ? "Período" : "Perfis"} className="flex gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm shadow-card">
              {grupo.map((o) => (
                <Link key={o.v} href={o.href} aria-current={o.ativo ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 ${o.ativo ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}>
                  {o.r}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </header>

      <section aria-label="Totais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Perfis", String(perfis.length)],
          ["Seguidores somados", formatarNumero(totalSeguidores)],
          [`Ganho em ${periodo} dias`, formatarVariacao(resumos.some((r) => r.ganho !== null) ? totalGanho : null)],
          ["Maior crescimento", ranking[0] && ranking[0].crescimentoPct !== null ? `@${porId.get(ranking[0].perfil_id)!.handle}` : "—"],
        ].map(([r, v]) => (
          <div key={r} className="rounded-balao border border-line bg-surface px-4 py-3 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{r}</div>
            {/* Um @perfil é mais longo que um número: entra um passo menor no celular para caber inteiro. */}
            <div className={`mt-1 font-display font-bold break-words tabular-nums ${v.startsWith("@") ? "text-base sm:text-lg xl:text-xl" : "text-2xl"}`}>{v}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-bold">Ranking</h2>
        {perfis.length === 0 ? (
          <p className="text-muted">Nenhum perfil neste grupo.</p>
        ) : (
          <div className="overflow-x-auto rounded-balao border border-line bg-surface shadow-card">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Perfil</th>
                  <Th campo="seguidores">Seguidores</Th>
                  <Th campo="ganho">Ganho</Th>
                  <Th campo="crescimento">Crescimento</Th>
                  <th className="px-4 py-3 text-right font-semibold">Posts</th>
                  <Th campo="engajamento">Engajamento</Th>
                  <th className="px-4 py-3 text-right font-semibold" title="Fatia dos seguidores somados">Part. audiência</th>
                  <th className="px-4 py-3 text-right font-semibold" title="Fatia dos novos seguidores do período">Part. crescimento</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const p = porId.get(r.perfil_id)!;
                  const pa = parts.get(r.perfil_id)!;
                  const cor = r.ganho === null || r.ganho === 0 ? "text-muted" : r.ganho > 0 ? "text-ok" : "text-danger";
                  return (
                    <tr key={r.perfil_id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-display text-lg font-bold text-muted">
                        {i === 0 && ranking.length > 1 ? (
                          <span className="grid size-7 place-items-center rounded-balao-sm bg-accent text-accent-ink" title="1º lugar">
                            <Estrela className="size-4" titulo="1º lugar" />
                          </span>
                        ) : (
                          i + 1
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/perfis/${p.handle}`} className="flex items-center gap-3">
                          <Avatar caminho={p.foto_path} handle={p.handle} />
                          <span>
                            <span className="block font-medium text-accent-strong">@{p.handle}</span>
                            <span className="block text-xs text-muted">{GRUPOS[p.grupo]}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatarNumero(r.seguidoresFim)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${cor}`}>{formatarVariacao(r.ganho)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${cor}`}>{r.crescimentoPct === null ? "—" : `${r.crescimentoPct > 0 ? "+" : ""}${formatarPct(r.crescimentoPct, 2)}`}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.postsNoPeriodo ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarPct(r.engajamentoPct, 2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(pa.audiencia)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(pa.crescimento)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted">
          Crescimento e posts comparam o primeiro e o último dia com coleta no período. Engajamento: média de curtidas e comentários dos 12 posts mais recentes sobre os seguidores.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-bold">Crescimento acumulado</h2>
        <p className="text-sm text-muted">Variação em % desde o início do período. Coloca perfis grandes e pequenos na mesma escala.</p>
        <GraficoLinhas series={series} titulo="Crescimento acumulado de seguidores por perfil" />
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-bold">Participação</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {([
            ["audiencia", "Audiência", "Fatia dos seguidores somados"],
            ["crescimento", "Crescimento", "Fatia dos novos seguidores do período"],
            ["engajamento", "Atenção", "Fatia das interações médias por post"],
            ["voz", "Presença", "Fatia dos posts publicados no período"],
          ] as const).map(([chave, titulo, dica]) => (
            <div key={chave} className="rounded-balao border border-line bg-surface p-4 shadow-card">
              <div className="font-semibold">{titulo}</div>
              <div className="mb-3 text-xs text-muted">{dica}</div>
              <ul className="grid gap-2">
                {ranking.map((r, i) => {
                  const v = parts.get(r.perfil_id)![chave];
                  return (
                    <li key={r.perfil_id} className="grid grid-cols-[130px_minmax(0,1fr)_56px] items-center gap-3 text-sm">
                      <span className="truncate">@{porId.get(r.perfil_id)!.handle}</span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-bg">
                        <span className="block h-full rounded-full" style={{ width: `${(v ?? 0) * 100}%`, background: `var(--serie-${Math.min(i, 5) + 1})` }} />
                      </span>
                      <span className="text-right tabular-nums text-muted">{pct(v)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
