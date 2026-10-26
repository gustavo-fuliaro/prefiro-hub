import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { CartaoIndicador } from "@/components/cartao-indicador";
import { GraficoColunas } from "@/components/grafico-colunas";
import { IconeAnterior } from "@/components/icones";
import { indicadores, ultimosPosts, type Leitura } from "@/lib/evolucao";
import { membroAtual, podeEditarCadastro } from "@/lib/membro";
import { PERIODOS, engajamento, filtrarPeriodo, formatarNumero, formatarPct, lerPeriodo, type Ponto } from "@/lib/metricas";
import { urlMidia } from "@/lib/midia";
import { GRUPOS, type Grupo } from "@/lib/perfis";
import { createClient } from "@/lib/supabase/server";
import { ColetarBotao } from "../coletar-botao";
import { ExcluirPerfil } from "../excluir-perfil";

type Params = { handle: string };
type Busca = { periodo?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

type Perfil = {
  id: number; handle: string; nome: string | null; grupo: Grupo; bio: string | null;
  foto_path: string | null; ultima_coleta_em: string | null; ultimo_erro: string | null;
};
type Snapshot = Ponto & { seguindo: number | null };
type Post = { id: string; tipo: string | null; produto: string | null; legenda: string | null; permalink: string | null; publicado_em: string | null; thumb_path: string | null };

const TIPO: Record<string, string> = { VIDEO: "Reel", CAROUSEL_ALBUM: "Carrossel", IMAGE: "Foto" };
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const inteiro = new Intl.NumberFormat("pt-BR");

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export default async function PerfilPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Busca> }) {
  const { handle } = await params;
  const periodo = lerPeriodo((await searchParams).periodo);
  const { membro } = await membroAtual();
  const pode = podeEditarCadastro(membro?.papel);
  const supabase = await createClient();

  // O RLS só devolve o perfil se ele for da conta de quem está logado.
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, handle, nome, grupo, bio, foto_path, ultima_coleta_em, ultimo_erro")
    .eq("handle", handle.toLowerCase())
    .maybeSingle<Perfil>();
  if (!perfil) notFound();

  const [{ data: snaps }, { data: posts }] = await Promise.all([
    supabase.from("snapshots_diarios").select("dia, seguidores, seguindo, total_posts").eq("perfil_id", perfil.id).order("dia").returns<Snapshot[]>(),
    supabase.from("posts").select("id, tipo, produto, legenda, permalink, publicado_em, thumb_path").eq("perfil_id", perfil.id)
      .order("publicado_em", { ascending: false }).limit(60).returns<Post[]>(),
  ]);

  const listaPosts = posts ?? [];
  const { data: metricas } = listaPosts.length
    ? await supabase.from("post_metricas").select("post_id, dia, likes, comentarios, views").in("post_id", listaPosts.map((p) => p.id)).order("dia").returns<Leitura[]>()
    : { data: [] as Leitura[] };
  const leituras = metricas ?? [];

  const ultima = new Map<string, Leitura>();
  for (const m of leituras) ultima.set(m.post_id, m);

  const hoje = hojeSP();
  const serie = snaps ?? [];
  const janela = filtrarPeriodo(serie, periodo, hoje);
  const atual = serie.at(-1);
  const ind = indicadores({ snapshots: serie, leituras, periodo, hoje });
  const barras = ultimosPosts(listaPosts, leituras, 8);

  const recentes = listaPosts.slice(0, 12).map((p) => ultima.get(p.id) ?? { likes: null, comentarios: null });
  const eng = engajamento(recentes, atual?.seguidores ?? null);

  const inicioJanela = janela[0]?.dia;
  const destaques = listaPosts
    .filter((p) => !inicioJanela || (p.publicado_em ?? "") >= inicioJanela)
    .map((p) => ({ p, inter: (ultima.get(p.id)?.likes ?? 0) + (ultima.get(p.id)?.comentarios ?? 0) }))
    .sort((a, b) => b.inter - a.inter)
    .slice(0, 3);

  const fmtDia = (d: string) => dataCurta.format(new Date(`${d}T12:00:00Z`));

  return (
    <div className="grid max-w-6xl gap-8">
      <Link href="/perfis" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent-strong"><IconeAnterior /> Todos os perfis</Link>

      <header className="flex flex-wrap items-start gap-5">
        <Avatar caminho={perfil.foto_path} handle={perfil.handle} tamanho={76} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">{perfil.nome ?? `@${perfil.handle}`}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <a href={`https://www.instagram.com/${perfil.handle}/`} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">
              @{perfil.handle}
            </a>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">{GRUPOS[perfil.grupo]}</span>
          </div>
          {perfil.bio && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted">{perfil.bio}</p>}
        </div>
        {pode && (
          <div className="flex flex-wrap items-center gap-2">
            <ColetarBotao perfilId={perfil.id} rotulo="Atualizar este perfil" />
            <ExcluirPerfil id={perfil.id} handle={perfil.handle} voltarParaLista />
          </div>
        )}
      </header>

      {perfil.ultimo_erro && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">Última coleta falhou: {perfil.ultimo_erro}</p>
      )}

      <section aria-label="Números atuais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Seguidores", formatarNumero(atual?.seguidores ?? null)],
          ["Posts", formatarNumero(atual?.total_posts ?? null)],
          ["Seguindo", formatarNumero(atual?.seguindo ?? null)],
          ["Engajamento médio", formatarPct(eng, 2)],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-balao border border-line bg-surface px-4 py-3 shadow-card">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{rotulo}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">{valor}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4" aria-labelledby="evolucao">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="evolucao" className="font-display text-xl font-bold">Evolução no tempo</h2>
            <p className="text-sm text-muted">
              {janela.length > 1
                ? `De ${fmtDia(janela[0].dia)} a ${fmtDia(janela.at(-1)!.dia)}. Verde: subiu mais de 2%. Vermelho: caiu mais de 2%.`
                : serie.length === 1
                  ? "Primeiro registro salvo. As curvas aparecem a partir da próxima coleta."
                  : "Ainda sem registros neste período."}
            </p>
          </div>
          <nav aria-label="Período" className="flex flex-wrap gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm shadow-card">
            {PERIODOS.map((p) => (
              <Link
                key={p.valor}
                href={`?periodo=${p.valor}`}
                aria-current={p.valor === periodo ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 ${p.valor === periodo ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}
              >
                {p.rotulo}
              </Link>
            ))}
          </nav>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ind.map((i) => <CartaoIndicador key={i.chave} i={i} />)}
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="desempenho">
        <div>
          <h2 id="desempenho" className="font-display text-xl font-bold">Desempenho dos últimos {barras.length || 8} posts</h2>
          <p className="text-sm text-muted">Última leitura de cada post, do mais antigo ao mais recente. Cada gráfico tem a própria escala.</p>
        </div>
        {barras.length === 0 ? (
          <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-sm text-muted">Os posts aparecem depois da primeira coleta.</p>
        ) : (
          <>
            <div className="grid gap-4 rounded-balao border border-line bg-surface p-4 shadow-card lg:grid-cols-3">
              <GraficoColunas titulo="Curtidas" chave="likes" posts={barras} semDado="Este perfil oculta as curtidas dos posts." />
              <GraficoColunas titulo="Comentários" chave="comentarios" posts={barras} semDado="Sem comentários registrados nestes posts." />
              <GraficoColunas titulo="Views" chave="views" posts={barras} semDado="Sem views nestes posts. A Meta só informa views de Reels, e a coleta passou a registrá-las em 26/10/2026." />
            </div>
            <details className="rounded-balao border border-line bg-surface px-4 py-3 text-sm shadow-card">
              <summary className="cursor-pointer font-medium">Ver os números em tabela</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead className="text-xs uppercase tracking-wide text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-semibold">Data</th>
                      <th className="py-2 pr-3 font-semibold">Formato</th>
                      <th className="py-2 pr-3 text-right font-semibold">Curtidas</th>
                      <th className="py-2 pr-3 text-right font-semibold">Comentários</th>
                      <th className="py-2 pr-3 text-right font-semibold">Views</th>
                      <th className="py-2 font-semibold">Post</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barras.map((b) => (
                      <tr key={b.id} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3 tabular-nums">{b.rotulo}</td>
                        <td className="py-2 pr-3">{b.formato}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.likes === null ? "—" : inteiro.format(b.likes)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.comentarios === null ? "—" : inteiro.format(b.comentarios)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b.views === null ? "—" : inteiro.format(b.views)}</td>
                        <td className="py-2">{b.permalink ? <a href={b.permalink} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">Abrir</a> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      {destaques.length > 0 && (
        <section className="grid gap-3">
          <h2 className="font-display text-xl font-bold">Melhores posts do período</h2>
          <ol className="grid gap-3 lg:grid-cols-3">
            {destaques.map(({ p, inter }, i) => (
              <li key={p.id} className="flex gap-3 rounded-balao border border-line bg-surface p-3 shadow-card">
                <span className="font-display text-2xl font-bold text-accent-strong">{i + 1}</span>
                <div className="min-w-0 text-sm">
                  <div className="font-semibold tabular-nums">{formatarNumero(inter)} interações</div>
                  <p className="line-clamp-2 text-muted">{p.legenda ?? "Sem legenda"}</p>
                  {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">Abrir no Instagram</a>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="font-display text-xl font-bold">Últimos posts</h2>
        {listaPosts.length === 0 ? (
          <p className="text-muted">Os posts aparecem depois da primeira coleta.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listaPosts.slice(0, 24).map((p) => {
              const m = ultima.get(p.id);
              const src = urlMidia(p.thumb_path);
              return (
                <li key={p.id} className="overflow-hidden rounded-balao border border-line bg-surface shadow-card">
                  <a href={p.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="relative aspect-square bg-bg">
                      {src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-white">
                        {p.produto === "REELS" ? "Reel" : TIPO[p.tipo ?? ""] ?? "Post"}
                      </span>
                    </div>
                    <div className="grid gap-0.5 px-3 py-2 text-xs tabular-nums text-muted">
                      <div className="flex justify-between gap-2">
                        <span title="Curtidas">{formatarNumero(m?.likes ?? null)} curt.</span>
                        <span title="Comentários">{formatarNumero(m?.comentarios ?? null)} coment.</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span title="Views (só Reels)">{m?.views != null ? `${formatarNumero(m.views)} views` : ""}</span>
                        <span>{p.publicado_em ? dataCurta.format(new Date(p.publicado_em)) : ""}</span>
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
