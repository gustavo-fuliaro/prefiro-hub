import type { Metadata } from "next";
import Link from "next/link";
import { METRICAS_META, ROTULO_STATUS, avaliarMeta, ritmoDiario, type MetricaMeta, type StatusMeta } from "@/lib/comparativo";
import { carregarComparativo, diasAtras, hojeSP } from "@/lib/dados-comparativo";
import { membroAtual, podeEditarCadastro } from "@/lib/membro";
import { formatarNumero } from "@/lib/metricas";
import { createClient } from "@/lib/supabase/server";
import { ExcluirMeta } from "./excluir-meta";
import { NovaMetaForm } from "./nova-meta-form";

export const metadata: Metadata = { title: "Metas" };

type Meta = { id: number; perfil_id: number; metrica: MetricaMeta; alvo: number; prazo: string; base: number | null; inicio: string };

const COR_STATUS: Record<StatusMeta | "abaixo", string> = {
  atingida: "bg-ok-soft text-ok",
  no_ritmo: "bg-ok-soft text-ok",
  atrasada: "bg-warn-soft text-warn",
  vencida: "bg-danger-soft text-danger",
  sem_dados: "bg-bg text-muted",
  abaixo: "bg-warn-soft text-warn",
};

const data = (d: string) => d.split("-").reverse().join("/");
const valor = (m: MetricaMeta, v: number | null) =>
  v === null ? "—" : m === "engajamento" ? `${v.toFixed(2).replace(".", ",")}%` : formatarNumero(v, { compacto: false });

export default async function MetasPage() {
  const hoje = hojeSP();
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const { membro } = await membroAtual();
  const pode = podeEditarCadastro(membro?.papel);
  const supabase = await createClient();

  const [{ data: metas }, dados, { data: postsMes }] = await Promise.all([
    supabase.from("metas").select("id, perfil_id, metrica, alvo, prazo, base, inicio").order("prazo").returns<Meta[]>(),
    carregarComparativo({ grupos: ["proprio", "time", "parceiro", "concorrente"], desde: diasAtras(hoje, 30) }),
    supabase.from("posts").select("perfil_id").gte("publicado_em", `${inicioMes}T03:00:00Z`).returns<{ perfil_id: number }[]>(),
  ]);
  const porId = new Map(dados.perfis.map((p) => [p.id, p]));
  const contagemMes = new Map<number, number>();
  for (const p of postsMes ?? []) contagemMes.set(p.perfil_id, (contagemMes.get(p.perfil_id) ?? 0) + 1);
  const diasDoMes = Number(hoje.slice(8, 10));

  const linhas = (metas ?? []).filter((m) => porId.has(m.perfil_id)).map((m) => {
    const serie = dados.snapshots.filter((s) => s.perfil_id === m.perfil_id);
    const ultimo = [...serie].reverse().find((s) => s.seguidores !== null);
    let atual: number | null = null;
    let ritmo: number | null = null;
    if (m.metrica === "seguidores") {
      atual = ultimo?.seguidores ?? null;
      ritmo = ritmoDiario(serie.map((s) => ({ dia: s.dia, valor: s.seguidores })), hoje);
    } else if (m.metrica === "engajamento") {
      const inter = dados.interacoes.get(m.perfil_id) ?? null;
      atual = inter !== null && ultimo?.seguidores ? (inter / ultimo.seguidores) * 100 : null;
    } else {
      atual = contagemMes.get(m.perfil_id) ?? 0;
      ritmo = atual / Math.max(1, diasDoMes);
    }
    const av = avaliarMeta({ base: m.base !== null ? Number(m.base) : null, atual, alvo: Number(m.alvo), hoje, prazo: m.prazo, ritmoDiario: ritmo });
    // Engajamento não tem "ritmo": abaixo do alvo e dentro do prazo vira "Abaixo do alvo".
    const status: StatusMeta | "abaixo" = m.metrica === "engajamento" && av.status === "sem_dados" && atual !== null ? "abaixo" : av.status;
    return { m, atual, ritmo, av, status };
  });

  const amanha = new Date(Date.parse(`${hoje}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const proprios = dados.perfis.filter((p) => p.grupo === "proprio");

  return (
    <div className="grid max-w-6xl gap-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Metas</h1>
        <p className="mt-1 text-muted">
          Alvos por perfil, com a previsão de quando cada um será atingido no ritmo dos últimos 30 dias. Metas fora do ritmo geram um alerta por semana.
        </p>
      </header>

      {pode && <NovaMetaForm perfis={proprios.length ? proprios : dados.perfis} amanha={amanha} />}

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="font-medium">Nenhuma meta criada.</p>
          <p className="mt-1 text-sm text-muted">Exemplo: @prefiroconsorcio com 20.000 seguidores até 31/03.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {linhas.map(({ m, atual, ritmo, av, status }) => {
            const p = porId.get(m.perfil_id)!;
            return (
              <li key={m.id} className="grid gap-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/perfis/${p.handle}`} className="text-sm font-semibold text-accent hover:underline">@{p.handle}</Link>
                    <div className="font-display text-xl font-extrabold">
                      {METRICAS_META[m.metrica].rotulo}: {valor(m.metrica, Number(m.alvo))}
                    </div>
                    <div className="text-xs text-muted">Prazo {data(m.prazo)} · criada em {data(m.inicio)}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${COR_STATUS[status]}`}>
                    {status === "abaixo" ? "Abaixo do alvo" : ROTULO_STATUS[status]}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={Math.round(av.progressoPct ?? 0)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full ${status === "atingida" ? "bg-ok" : "bg-accent"}`} style={{ width: `${av.progressoPct ?? 0}%` }} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted">Partida</dt><dd className="tabular-nums">{valor(m.metrica, m.base !== null ? Number(m.base) : null)}</dd></div>
                  <div><dt className="text-xs text-muted">Atual</dt><dd className="font-semibold tabular-nums">{valor(m.metrica, atual)}</dd></div>
                  <div>
                    <dt className="text-xs text-muted">{m.metrica === "engajamento" ? "Falta" : "Previsão"}</dt>
                    <dd className="tabular-nums">
                      {m.metrica === "engajamento"
                        ? valor("engajamento", av.faltam)
                        : av.previsao ? data(av.previsao) : status === "atingida" ? "—" : "Sem previsão"}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    {ritmo !== null && m.metrica !== "engajamento"
                      ? `Ritmo: ${ritmo >= 0 ? "+" : ""}${ritmo.toFixed(1).replace(".", ",")} ${m.metrica === "posts_mes" ? "posts" : "seguidores"} por dia`
                      : m.metrica === "seguidores" ? "Ritmo aparece com 2 ou mais dias de coleta" : ""}
                  </span>
                  {pode && <ExcluirMeta id={m.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
