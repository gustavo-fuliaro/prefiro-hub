import type { Metadata } from "next";
import Link from "next/link";
import { IconeAnterior, IconeProximo } from "@/components/icones";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { listarIdeias, listarPerfisAtivos } from "@/lib/dados-planejador";
import { COLUNAS, STATUS_PRODUCAO, deslocarMes, gradeDoMes, lerMes, partesSP, porDia, type Ideia } from "@/lib/planejador";

export const metadata: Metadata = { title: "Calendário" };

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Etapa da ideia como um ponto colorido (Ideias, Em produção, Publicado).
const PONTO: Record<Ideia["coluna"], string> = {
  garagem: "bg-line-strong",
  pista: "bg-warn",
  chegada: "bg-ok",
};
const Ponto = ({ coluna }: { coluna: Ideia["coluna"] }) => <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${PONTO[coluna]}`} />;

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function nomeMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const s = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; mes?: string; visao?: string }>;
}) {
  const busca = await searchParams;
  const hoje = hojeSP();
  const mes = lerMes(busca.mes, hoje);
  const visao = busca.visao === "lista" ? "lista" : "mes";
  const perfis = await listarPerfisAtivos();
  const perfil = perfis.find((p) => p.handle === busca.perfil) ?? null;
  const handlePorId = new Map(perfis.map((p) => [p.id, p.handle]));

  const ideias = await listarIdeias(perfil?.id);
  const agendadas = ideias.filter((i) => i.publicar_em);
  const semData = ideias.filter((i) => !i.publicar_em && i.coluna !== "chegada");
  const dias = porDia(agendadas);

  const link = (extra: Record<string, string>) => {
    const qs = new URLSearchParams({ mes, visao, ...(perfil ? { perfil: perfil.handle } : {}), ...extra });
    return `/calendario?${qs}`;
  };
  const linkIdeia = (i: Ideia) => `/planejador?perfil=${handlePorId.get(i.perfil_id)}&ideia=${i.id}`;

  const Chip = ({ i }: { i: Ideia }) => (
    <Link
      href={linkIdeia(i)}
      title={i.titulo}
      className="flex items-center gap-1.5 rounded-md bg-bg px-1.5 py-1 text-xs transition-colors hover:bg-accent-wash"
    >
      <Ponto coluna={i.coluna} />
      <span className="truncate">
        <span className="text-muted tabular-nums">{partesSP(i.publicar_em!).hora}</span>{" "}
        <span className="text-ink">{i.titulo}</span>
        {!perfil && <span className="text-muted"> · @{handlePorId.get(i.perfil_id)}</span>}
      </span>
    </Link>
  );

  const doMes = [...dias.entries()].filter(([d]) => d.startsWith(mes)).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Calendário de postagem</h1>
          <p className="mt-1 text-muted">Ideias com data de postagem, de todos os perfis ou de um só. Clique para editar no planejador.</p>
        </div>
        <SeletorPerfil perfis={perfis} atual={perfil?.handle ?? null} base="/calendario" extra={{ mes, visao }} incluirTodos />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={link({ mes: deslocarMes(mes, -1) })} className="grid size-9 place-items-center rounded-md border border-line bg-surface hover:border-accent" aria-label="Mês anterior"><IconeAnterior /></Link>
          <h2 className="min-w-44 text-center font-display text-xl font-bold">{nomeMes(mes)}</h2>
          <Link href={link({ mes: deslocarMes(mes, 1) })} className="grid size-9 place-items-center rounded-md border border-line bg-surface hover:border-accent" aria-label="Próximo mês"><IconeProximo /></Link>
          {mes !== hoje.slice(0, 7) && (
            <Link href={link({ mes: hoje.slice(0, 7) })} className="text-sm text-accent-strong hover:underline">Hoje</Link>
          )}
        </div>
        <nav aria-label="Visão" className="flex gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm shadow-card">
          {[["mes", "Mês"], ["lista", "Lista"]].map(([v, r]) => (
            <Link key={v} href={link({ visao: v })} aria-current={visao === v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${visao === v ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}>
              {r}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {COLUNAS.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5"><Ponto coluna={c.id} />{c.rotulo}</span>
        ))}
      </div>

      {visao === "mes" ? (
        <div className="overflow-x-auto rounded-balao border border-line bg-surface shadow-card">
          <div className="grid min-w-[720px] grid-cols-7">
            {SEMANA.map((d) => (
              <div key={d} className="border-b border-line px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">{d}</div>
            ))}
            {gradeDoMes(mes, hoje).flat().map((dia) => {
              const itens = dias.get(dia.data) ?? [];
              return (
                <div key={dia.data} className={`min-h-28 border-b border-r border-line p-1.5 ${dia.doMes ? "" : "bg-bg opacity-60"}`}>
                  <div className={`mb-1 text-right text-xs tabular-nums ${dia.hoje ? "font-bold text-accent-strong" : "text-muted"}`}>
                    {Number(dia.data.slice(8))}
                  </div>
                  <div className="grid gap-1">
                    {itens.slice(0, 3).map((i) => <Chip key={i.id} i={i} />)}
                    {itens.length > 3 && <span className="px-1 text-xs text-muted">+{itens.length - 3} mais</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : doMes.length === 0 ? (
        <p className="rounded-balao border border-dashed border-line px-6 py-10 text-center text-muted">Nada agendado em {nomeMes(mes).toLowerCase()}.</p>
      ) : (
        <ol className="grid gap-4">
          {doMes.map(([dia, itens]) => (
            <li key={dia} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
              <div className="font-semibold tabular-nums">{dia.split("-").reverse().join("/")}</div>
              <ul className="grid gap-1.5">
                {itens.map((i) => (
                  <li key={i.id}>
                    <Link href={linkIdeia(i)} className="flex flex-wrap items-center gap-x-3 rounded-balao-sm border border-line bg-surface px-3 py-2 transition-colors hover:border-accent">
                      <Ponto coluna={i.coluna} />
                      <span className="text-muted tabular-nums">{partesSP(i.publicar_em!).hora}</span>
                      <span className="font-medium text-ink">{i.titulo}</span>
                      <span className="text-xs text-muted">
                        @{handlePorId.get(i.perfil_id)}
                        {i.formato ? ` · ${i.formato}` : ""}
                        {i.status_producao ? ` · ${STATUS_PRODUCAO[i.status_producao]}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {semData.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-display text-lg font-bold">Sem data ({semData.length})</h2>
          <ul className="flex flex-wrap gap-2">
            {semData.map((i) => (
              <li key={i.id}>
                <Link href={linkIdeia(i)} className="block rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent">
                  {i.titulo}
                  {!perfil && <span className="text-muted"> · @{handlePorId.get(i.perfil_id)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
