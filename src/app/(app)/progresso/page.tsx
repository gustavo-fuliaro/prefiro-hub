import type { Metadata } from "next";
import Link from "next/link";
import { CapaPost } from "@/components/capa-post";
import { Estrela } from "@/components/marca";
import { METRICAS_META, isMetricaMeta } from "@/lib/comparativo";
import { hojeSP } from "@/lib/dados-comparativo";
import { membroAtual, podeEditarCadastro } from "@/lib/membro";
import { formatarNumero, formatarPct, formatarVariacao } from "@/lib/metricas";
import { urlMidia } from "@/lib/midia";
import { destaques, diferenca, isDataIso, lerRelatorio, linhasPerfis, progressoMeta, rotuloSemana, segundaDaSemana, totais } from "@/lib/relatorio";
import { createClient } from "@/lib/supabase/server";
import { GerarRelatorio, Imprimir } from "./botoes";

export const metadata: Metadata = { title: "Progresso" };

type Relatorio = { id: number; semana_inicio: string; semana_fim: string; parcial: boolean; dados: unknown; gerado_em: string };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const share = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`);
const dataBr = (d: string) => d.split("-").reverse().join("/");

const ROTULO_ALERTA: Record<string, string> = {
  queda_seguidores: "Quedas de seguidores",
  post_destaque: "Posts em destaque",
  meta_em_risco: "Metas fora do ritmo",
  coleta_erro: "Falhas de coleta",
};

function Kpi({ rotulo, valor, delta }: { rotulo: string; valor: string; delta?: number | null }) {
  return (
    <div className="rounded-balao border border-line bg-surface p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{rotulo}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{valor}</div>
      {delta !== undefined && (
        <div className={`mt-0.5 text-xs tabular-nums ${delta === null ? "text-muted" : delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : "text-muted"}`}>
          {delta === null ? "sem semana anterior" : `${formatarVariacao(delta)} vs. semana anterior`}
        </div>
      )}
    </div>
  );
}

export default async function ProgressoPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const busca = await searchParams;
  const { membro } = await membroAtual();
  const pode = podeEditarCadastro(membro?.papel);
  const hoje = hojeSP();
  const semanaAtual = segundaDaSemana(hoje);

  const supabase = await createClient();
  const { data } = await supabase
    .from("relatorios")
    .select("id, semana_inicio, semana_fim, parcial, dados, gerado_em")
    .order("semana_inicio", { ascending: false })
    .limit(26)
    .returns<Relatorio[]>();
  const lista = data ?? [];
  const escolhida = isDataIso(busca.semana) ? busca.semana : null;
  const rel = lista.find((r) => r.semana_inicio === escolhida) ?? lista[0] ?? null;
  const anterior = rel ? lista.find((r) => r.semana_inicio < rel.semana_inicio) ?? null : null;

  const cabecalho = (
    <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Progresso</h1>
        <p className="mt-1 text-muted">Relatório semanal dos perfis, gerado toda segunda às 8h com os números da semana anterior.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {pode && <GerarRelatorio inicio={semanaAtual} rotulo={lista.some((r) => r.semana_inicio === semanaAtual) ? "Atualizar semana atual" : "Gerar prévia da semana atual"} />}
        {rel && <Imprimir />}
      </div>
    </header>
  );

  if (!rel) {
    return (
      <div className="grid max-w-6xl gap-6">
        {cabecalho}
        <div className="rounded-balao border border-dashed border-line px-6 py-10 text-center">
          <p className="font-medium">Nenhum relatório ainda.</p>
          <p className="mt-1 text-sm text-muted">O primeiro sai na segunda às 8h. {pode ? "Você também pode gerar uma prévia da semana atual agora." : ""}</p>
        </div>
      </div>
    );
  }

  const d = lerRelatorio(rel.dados);
  const linhas = linhasPerfis(d.perfis);
  const t = totais(linhas);
  const tAnt = anterior ? totais(linhasPerfis(lerRelatorio(anterior.dados).perfis)) : null;
  const frases = destaques(linhas, d.top_posts);
  const incompletos = linhas.filter((l) => l.coberturaIncompleta);
  const alertas = Object.entries(d.alertas).filter(([, n]) => n > 0);

  return (
    <div className="grid max-w-6xl gap-6">
      {cabecalho}

      <nav aria-label="Semanas" className="flex flex-wrap gap-1.5 print:hidden">
        {lista.map((r) => (
          <Link
            key={r.id}
            href={`/progresso?semana=${r.semana_inicio}`}
            aria-current={r.id === rel.id ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm tabular-nums ${r.id === rel.id ? "border-accent bg-accent-soft text-accent-strong" : "border-line hover:border-accent"}`}
          >
            {rotuloSemana(r.semana_inicio, r.semana_fim)}
            {r.parcial && " (prévia)"}
          </Link>
        ))}
      </nav>

      <section className="grid gap-1">
        <h2 className="font-display text-2xl font-bold">
          Semana de {rotuloSemana(rel.semana_inicio, rel.semana_fim)}
          {rel.parcial && <span className="ml-2 align-middle rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Prévia: semana em andamento</span>}
        </h2>
        <p className="text-xs text-muted">Gerado em {quando.format(new Date(rel.gerado_em))}</p>
        {pode && rel.parcial && rel.semana_inicio !== semanaAtual && (
          <div className="mt-2"><GerarRelatorio inicio={rel.semana_inicio} rotulo="Refazer com a semana fechada" /></div>
        )}
      </section>

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
