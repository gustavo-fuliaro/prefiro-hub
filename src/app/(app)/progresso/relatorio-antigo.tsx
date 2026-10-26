import Link from "next/link";
import { CapaPost } from "@/components/capa-post";
import { Estrela } from "@/components/marca";
import { METRICAS_META, isMetricaMeta } from "@/lib/comparativo";
import { formatarNumero, formatarPct, formatarVariacao } from "@/lib/metricas";
import { urlMidia } from "@/lib/midia";
import { destaques, diferenca, lerRelatorio, linhasPerfis, progressoMeta, totais } from "@/lib/relatorio";
import { Kpi } from "./kpi";

const share = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);
const dataBr = (d: string) => d.split("-").reverse().join("/");

const ROTULO_ALERTA: Record<string, string> = {
  queda_seguidores: "Quedas de seguidores",
  post_destaque: "Posts em destaque",
  meta_em_risco: "Metas fora do ritmo",
  coleta_erro: "Falhas de coleta",
};

// Relatório antigo (formato 1, gerado às segundas até outubro de 2026). Mantido para consulta.
export function RelatorioAntigo({ rel, anterior }: { rel: { dados: unknown }; anterior: { dados: unknown } | null }) {
  const d = lerRelatorio(rel.dados);
  const linhas = linhasPerfis(d.perfis);
  const t = totais(linhas);
  const tAnt = anterior ? totais(linhasPerfis(lerRelatorio(anterior.dados).perfis)) : null;
  const frases = destaques(linhas, d.top_posts);
  const incompletos = linhas.filter((l) => l.coberturaIncompleta);
  const alertas = Object.entries(d.alertas).filter(([, n]) => n > 0);

  return (
    <div className="grid gap-6">
      {frases.length > 0 && (
        // Os destaques da semana como uma fala da Prefiro: balão laranja-claro com a estrela.
        <div className="flex items-start gap-3 rounded-balao bg-accent-wash p-4 text-sm">
          <Estrela className="mt-0.5 size-5 shrink-0 text-accent" />
          <ul className="grid gap-1">
            {frases.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi rotulo="Seguidores (soma)" valor={formatarNumero(t.seguidores, { compacto: false })} />
        <Kpi rotulo="Ganho na semana" valor={formatarVariacao(t.ganho)} delta={tAnt ? diferenca(t.ganho, tAnt.ganho) : null} />
        <Kpi rotulo="Posts" valor={formatarNumero(t.posts)} delta={tAnt ? diferenca(t.posts, tAnt.posts) : null} />
        <Kpi rotulo="Interações" valor={formatarNumero(t.interacoes)} delta={tAnt ? diferenca(t.interacoes, tAnt.interacoes) : null} />
      </div>

      <section className="grid gap-3">
        <h3 className="font-display text-lg font-bold">Perfis</h3>
        <div className="overflow-x-auto rounded-balao border border-line bg-surface shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Perfil</th>
                <th className="px-4 py-3 text-right font-semibold">Seguidores</th>
                <th className="px-4 py-3 text-right font-semibold">Ganho</th>
                <th className="px-4 py-3 text-right font-semibold">Cresc.</th>
                <th className="px-4 py-3 text-right font-semibold" title="Fatia de cada perfil no total de seguidores ganhos">Fatia do ganho</th>
                <th className="px-4 py-3 text-right font-semibold">Posts</th>
                <th className="px-4 py-3 text-right font-semibold">Interações</th>
                <th className="px-4 py-3 text-right font-semibold">Média/post</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/perfis/${l.handle}`} className="font-medium text-accent-strong hover:underline">@{l.handle}</Link>
                    {l.coberturaIncompleta && <span className="ml-1 text-xs text-muted" title={`${l.dias_coletados} de 7 dias com leitura`}>*</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(l.seguidores_fim, { compacto: false })}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${l.ganho === null ? "" : l.ganho > 0 ? "text-ok" : l.ganho < 0 ? "text-danger" : ""}`}>{formatarVariacao(l.ganho)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatarPct(l.crescimentoPct, 2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{share(l.shareCrescimento)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.posts}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(l.interacoes)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(l.mediaInteracoes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {incompletos.length > 0 && (
          <p className="text-xs text-muted">* Menos de 7 dias de coleta nesta semana. O ganho cobre só os dias com leitura.</p>
        )}
      </section>

      {d.top_posts.length > 0 && (
        <section className="grid gap-3">
          <h3 className="font-display text-lg font-bold">Posts com mais interações</h3>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.top_posts.map((p, i) => {
              const thumb = urlMidia(p.thumb_path);
              return (
                <li key={p.id} className="flex gap-3 rounded-balao border border-line bg-surface p-3 shadow-card">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-balao-sm bg-bg">
                    <CapaPost src={thumb} formato={p.produto === "REELS" ? "Reel" : p.tipo === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto"} className="size-full" />
                    {i === 0 ? (
                      <span className="absolute left-1 top-1 grid size-6 place-items-center rounded-balao-sm bg-accent text-accent-ink" title="Melhor post da semana">
                        <Estrela className="size-3.5" titulo="1º lugar" />
                      </span>
                    ) : (
                      <span className="absolute left-1 top-1 rounded-md bg-surface/90 px-1.5 text-[11px] font-bold tabular-nums">{i + 1}º</span>
                    )}
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold">@{p.handle}</div>
                    <div className="tabular-nums text-muted">
                      {formatarNumero(p.interacoes)} interações · {formatarNumero(p.likes)} curtidas · {formatarNumero(p.comentarios)} coment.
                    </div>
                    <p className="mt-1 line-clamp-2">{p.legenda ?? "Sem legenda"}</p>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-strong hover:underline print:hidden">Abrir no Instagram</a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid content-start gap-3">
          <h3 className="font-display text-lg font-bold">Metas</h3>
          {d.metas.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma meta ativa. <Link href="/metas" className="text-accent-strong hover:underline print:hidden">Criar meta</Link></p>
          ) : (
            <ul className="grid gap-2">
              {d.metas.map((m) => {
                const pct = progressoMeta(m);
                const rotulo = isMetricaMeta(m.metrica) ? METRICAS_META[m.metrica].rotulo : m.metrica;
                return (
                  <li key={m.id} className="rounded-balao border border-line bg-surface p-3 text-sm shadow-card">
                    <div className="flex justify-between gap-2">
                      <span><span className="font-semibold">@{m.handle}</span> · {rotulo}: {formatarNumero(m.alvo, { compacto: false })} até {dataBr(m.prazo)}</span>
                      <span className="tabular-nums text-muted">{pct === null ? "—" : `${Math.round(pct)}%`}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={Math.round(pct ?? 0)} aria-valuemin={0} aria-valuemax={100}>
                      <div className={`h-full rounded-full ${pct === 100 ? "bg-ok" : "bg-accent"}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    {m.atual === null && <p className="mt-1 text-xs text-muted">Engajamento é acompanhado na tela de Metas.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-3">
          <h3 className="font-display text-lg font-bold">Ideias do planejador publicadas</h3>
          {d.ideias_publicadas.length === 0 ? (
            <p className="text-sm text-muted">Nenhum post desta semana foi ligado a uma ideia. Ligue o post na ideia, no planejador, para medir o resultado.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {d.ideias_publicadas.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 rounded-balao border border-line bg-surface p-3 shadow-card">
                  <span><span className="font-semibold">@{i.handle}</span> · {i.titulo}</span>
                  <span className="shrink-0 tabular-nums text-muted">{formatarNumero(i.interacoes)} interações</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-3 font-display text-lg font-bold">Alertas da semana</h3>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted">Nenhum alerta.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {alertas.map(([tipo, n]) => (
                <li key={tipo} className="flex justify-between"><span>{ROTULO_ALERTA[tipo] ?? tipo}</span><span className="tabular-nums">{n}</span></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
