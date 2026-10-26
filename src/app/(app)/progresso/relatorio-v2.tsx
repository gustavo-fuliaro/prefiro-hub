import Link from "next/link";
import { CapaPost } from "@/components/capa-post";
import { Estrela } from "@/components/marca";
import { formatarNumero, formatarPct, formatarVariacao } from "@/lib/metricas";
import { urlMidia } from "@/lib/midia";
import { comparar, gargalos, lerRelatorioV2, rotuloIndisponiveis } from "@/lib/producao";
import { destaques, diferenca, linhasPerfis, totais } from "@/lib/relatorio";
import { STATUS_LABEL, STATUS_ORDEM } from "@/lib/tarefas";
import { Kpi } from "./kpi";

// Relatório de formato 2: Categoria A (produtividade, do histórico das tarefas) e
// Categoria B (Instagram, só métricas que a integração entrega de verdade).
export function RelatorioV2({ dados, anterior, dias }: { dados: unknown; anterior: unknown | null; dias: number }) {
  const r = lerRelatorioV2(dados);
  const ant = anterior ? lerRelatorioV2(anterior) : null;
  const p = r.producao;
  const comp = comparar(p, ant?.producao ?? null);
  const alertasProducao = gargalos(p);

  const linhas = linhasPerfis(r.instagram.perfis, dias);
  const t = totais(linhas);
  const tAnt = ant ? totais(linhasPerfis(ant.instagram.perfis, dias)) : null;
  const frases = destaques(linhas, r.instagram.top_posts);
  const views = r.instagram.perfis.some((x) => x.views !== null);
  const pessoas = p.por_responsavel.filter((x) => x.id !== null || x.criadas + x.concluidas + x.pendentes > 0);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="cat-a" className="grid gap-4">
        <div>
          <h3 id="cat-a" className="font-display text-xl font-bold">Produção da equipe</h3>
          <p className="text-sm text-muted">Calculado pelo histórico das tarefas do Planejador no período.</p>
        </div>

        {alertasProducao.length > 0 && (
          <div className="grid gap-1 rounded-balao border border-warn/40 bg-warn-soft p-4 text-sm">
            <span className="font-semibold text-warn">Pontos de atenção</span>
            <ul className="grid gap-1">
              {alertasProducao.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {comp.map((c) => (
            <Kpi key={c.rotulo} rotulo={c.rotulo} valor={String(c.atual)} delta={c.anterior === null ? null : c.atual - c.anterior} menorMelhor={!c.maiorMelhor} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-2 rounded-balao border border-line bg-surface p-4 shadow-card">
            <h4 className="font-display text-base font-bold">Etapas no fechamento</h4>
            <p className="text-xs text-muted">Quantas tarefas estavam em cada etapa e quantas entraram nela durante o período.</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1.5 font-semibold">Etapa</th>
                  <th className="py-1.5 text-right font-semibold">No fechamento</th>
                  <th className="py-1.5 text-right font-semibold">Entradas</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDEM.map((s) => (
                  <tr key={s} className="border-t border-line">
                    <td className="py-2">{STATUS_LABEL[s]}</td>
                    <td className="py-2 text-right tabular-nums">{p.etapas_agora[s] ?? 0}</td>
                    <td className="py-2 text-right tabular-nums">{p.movimentos_por_etapa[s] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid content-start gap-2 rounded-balao border border-line bg-surface p-4 shadow-card">
            <h4 className="font-display text-base font-bold">Por responsável</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="py-1.5 font-semibold">Pessoa</th>
                    <th className="py-1.5 text-right font-semibold" title="Tarefas criadas no período com esta pessoa como responsável">Criadas</th>
                    <th className="py-1.5 text-right font-semibold">Concluídas</th>
                    <th className="py-1.5 text-right font-semibold" title="Mudanças de etapa feitas pela pessoa">Movimentos</th>
                    <th className="py-1.5 text-right font-semibold">Pendentes</th>
                    <th className="py-1.5 text-right font-semibold">Atrasadas</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((x) => (
                    <tr key={x.id ?? "sem"} className="border-t border-line">
                      <td className={`py-2 ${x.id ? "font-medium" : "text-muted"}`}>{x.nome}</td>
                      <td className="py-2 text-right tabular-nums">{x.criadas}</td>
                      <td className="py-2 text-right tabular-nums">{x.concluidas}</td>
                      <td className="py-2 text-right tabular-nums">{x.id ? x.movimentacoes : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{x.pendentes}</td>
                      <td className={`py-2 text-right tabular-nums ${x.atrasadas > 0 ? "font-semibold text-danger" : ""}`}>{x.atrasadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="cat-b" className="grid gap-4">
        <div>
          <h3 id="cat-b" className="font-display text-xl font-bold">Instagram</h3>
          <p className="text-sm text-muted">Números coletados dos perfis monitorados, só dos posts publicados no período.</p>
        </div>

        {r.instagram.indisponiveis.length > 0 && (
          <p className="rounded-balao border border-line bg-surface px-4 py-3 text-sm text-muted">
            Indisponível nesta integração: {rotuloIndisponiveis(r.instagram.indisponiveis)}. A Meta só entrega esses números para quem é dono da conta, então eles não entram no relatório.
          </p>
        )}

        {frases.length > 0 && (
          <div className="flex items-start gap-3 rounded-balao bg-accent-wash p-4 text-sm">
            <Estrela className="mt-0.5 size-5 shrink-0 text-accent" />
            <ul className="grid gap-1">
              {frases.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi rotulo="Seguidores (soma)" valor={formatarNumero(t.seguidores, { compacto: false })} />
          <Kpi rotulo="Ganho no período" valor={formatarVariacao(t.ganho)} delta={tAnt ? diferenca(t.ganho, tAnt.ganho) : null} />
          <Kpi rotulo="Posts" valor={formatarNumero(t.posts)} delta={tAnt ? diferenca(t.posts, tAnt.posts) : null} />
          <Kpi rotulo="Interações" valor={formatarNumero(t.interacoes)} delta={tAnt ? diferenca(t.interacoes, tAnt.interacoes) : null} />
        </div>

        {linhas.length === 0 ? (
          <p className="text-sm text-muted">Nenhum perfil ativo no ambiente.</p>
        ) : (
          <div className="overflow-x-auto rounded-balao border border-line bg-surface shadow-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Perfil</th>
                  <th className="px-4 py-3 text-right font-semibold">Seguidores</th>
                  <th className="px-4 py-3 text-right font-semibold">Ganho</th>
                  <th className="px-4 py-3 text-right font-semibold">Cresc.</th>
                  <th className="px-4 py-3 text-right font-semibold">Posts</th>
                  <th className="px-4 py-3 text-right font-semibold">Curtidas</th>
                  <th className="px-4 py-3 text-right font-semibold">Comentários</th>
                  {views && <th className="px-4 py-3 text-right font-semibold" title="Visualizações de Reels">Views</th>}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const v2 = r.instagram.perfis.find((x) => x.id === l.id);
                  return (
                    <tr key={l.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/perfis/${l.handle}`} className="font-medium text-accent-strong hover:underline">@{l.handle}</Link>
                        {l.coberturaIncompleta && <span className="ml-1 text-xs text-muted" title={`${l.dias_coletados} de ${dias} dias com leitura`}>*</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(l.seguidores_fim, { compacto: false })}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${l.ganho === null ? "" : l.ganho > 0 ? "text-ok" : l.ganho < 0 ? "text-danger" : ""}`}>{formatarVariacao(l.ganho)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarPct(l.crescimentoPct, 2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{l.posts}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(v2?.likes ?? null)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(v2?.comentarios ?? null)}</td>
                      {views && <td className="px-4 py-3 text-right tabular-nums">{formatarNumero(v2?.views ?? null)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {linhas.some((l) => l.coberturaIncompleta) && (
          <p className="text-xs text-muted">* Menos dias de coleta que o período. O ganho cobre só os dias com leitura.</p>
        )}

        {r.instagram.top_posts.length > 0 && (
          <div className="grid gap-3">
            <h4 className="font-display text-base font-bold">Posts com mais interações</h4>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {r.instagram.top_posts.map((post, i) => (
                <li key={post.id} className="flex gap-3 rounded-balao border border-line bg-surface p-3 shadow-card">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-balao-sm bg-bg">
                    <CapaPost src={urlMidia(post.thumb_path)} formato={post.produto === "REELS" ? "Reel" : post.tipo === "CAROUSEL_ALBUM" ? "Carrossel" : "Foto"} className="size-full" />
                    <span className="absolute top-1 left-1 rounded-md bg-surface/90 px-1.5 text-[11px] font-bold tabular-nums">{i + 1}º</span>
                  </div>
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold">@{post.handle}</div>
                    <div className="text-muted tabular-nums">
                      {formatarNumero(post.interacoes)} interações
                      {post.views !== null ? ` · ${formatarNumero(post.views)} views` : ""}
                    </div>
                    <p className="mt-1 line-clamp-2">{post.legenda ?? "Sem legenda"}</p>
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-strong hover:underline print:hidden">Abrir no Instagram</a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
