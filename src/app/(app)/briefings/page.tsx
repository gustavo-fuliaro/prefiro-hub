import type { Metadata } from "next";
import Link from "next/link";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { escolherPerfil, listarIdeias, listarPerfisAtivos } from "@/lib/dados-planejador";
import { membroAtual, podeEditarConteudo } from "@/lib/membro";
import { AMBIENTES, COLUNAS, partesSP, progressoChecklist, type Ambiente, type Checklist } from "@/lib/planejador";
import { createClient } from "@/lib/supabase/server";
import { BriefingCard } from "./briefing-card";

export const metadata: Metadata = { title: "Briefings" };

type Briefing = { ideia_id: number; checklist: Checklist; observacoes: string | null };

const GRUPOS: { id: Ambiente | "sem"; rotulo: string }[] = [
  ...(Object.entries(AMBIENTES) as [Ambiente, string][]).map(([id, rotulo]) => ({ id, rotulo })),
  { id: "sem", rotulo: "Local não definido" },
];

export default async function BriefingsPage({ searchParams }: { searchParams: Promise<{ perfil?: string; publicados?: string }> }) {
  const busca = await searchParams;
  const { membro } = await membroAtual();
  const perfis = await listarPerfisAtivos();
  const perfil = escolherPerfil(perfis, busca.perfil);
  if (!perfil) return <p className="text-muted">Cadastre um perfil para usar os briefings.</p>;

  const verPublicados = busca.publicados === "1";
  const todas = await listarIdeias(perfil.id);
  const ideias = todas.filter((i) => verPublicados || i.coluna !== "chegada");

  const supabase = await createClient();
  const { data: briefings } = ideias.length
    ? await supabase.from("briefings").select("ideia_id, checklist, observacoes").in("ideia_id", ideias.map((i) => i.id)).returns<Briefing[]>()
    : { data: [] as Briefing[] };
  const porIdeia = new Map((briefings ?? []).map((b) => [b.ideia_id, b]));

  const contagem = COLUNAS.map((c) => ({ ...c, n: todas.filter((i) => i.coluna === c.id).length }));
  const prontas = ideias.filter((i) => progressoChecklist(porIdeia.get(i.id)?.checklist).pct === 100).length;
  const podeEditar = podeEditarConteudo(membro?.papel);

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Briefings de gravação</h1>
          <p className="mt-1 text-muted">Ideias agrupadas por onde gravar, para aproveitar cada sessão. Marque o checklist conforme avança.</p>
        </div>
        <SeletorPerfil perfis={perfis} atual={perfil.handle} base="/briefings" extra={verPublicados ? { publicados: "1" } : {}} />
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {contagem.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{c.rotulo}</div>
            <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{c.n}</div>
          </div>
        ))}
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Checklist completo</div>
          <div className="mt-1 font-display text-2xl font-extrabold tabular-nums">{prontas}<span className="text-base text-muted"> / {ideias.length}</span></div>
        </div>
      </section>

      <div className="flex justify-end text-sm">
        <Link
          href={`/briefings?perfil=${perfil.handle}${verPublicados ? "" : "&publicados=1"}`}
          className="text-accent hover:underline"
        >
          {verPublicados ? "Esconder publicados" : "Mostrar também os publicados"}
        </Link>
      </div>

      {ideias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <p className="font-medium">Nenhuma ideia para gravar.</p>
          <p className="mt-1 text-sm text-muted">
            Crie ideias no <Link href={`/planejador?perfil=${perfil.handle}`} className="text-accent hover:underline">planejador</Link>.
          </p>
        </div>
      ) : (
        <div className="grid gap-8">
          {GRUPOS.map((g) => {
            const doGrupo = ideias.filter((i) => (i.ambiente ?? "sem") === g.id);
            if (!doGrupo.length) return null;
            return (
              <section key={g.id} className="grid gap-3">
                <h2 className="font-display text-xl font-extrabold">
                  {g.rotulo} <span className="text-base font-semibold text-muted">({doGrupo.length})</span>
                </h2>
                <div className="grid gap-3 lg:grid-cols-2">
                  {doGrupo.map((i) => (
                    <BriefingCard
                      key={i.id}
                      ideia={i}
                      coluna={COLUNAS.find((c) => c.id === i.coluna)!.rotulo}
                      quando={i.publicar_em ? `${partesSP(i.publicar_em).data.split("-").reverse().join("/")} ${partesSP(i.publicar_em).hora}` : null}
                      checklist={porIdeia.get(i.id)?.checklist ?? {}}
                      observacoes={porIdeia.get(i.id)?.observacoes ?? ""}
                      linkPlanejador={`/planejador?perfil=${perfil.handle}&ideia=${i.id}`}
                      podeEditar={podeEditar}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
