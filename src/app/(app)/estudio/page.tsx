import type { Metadata } from "next";
import Link from "next/link";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { estudioLiberado } from "@/lib/config";
import { escolherPerfil, listarIdeias, listarPerfisAtivos } from "@/lib/dados-planejador";
import { TIPOS_GERACAO, completudePosicionamento, isTipoGeracao, type Posicionamento } from "@/lib/estudio";
import { membroAtual, podeEditarConteudo } from "@/lib/membro";
import { createClient } from "@/lib/supabase/server";
import { BloquearEstudio, EstudioBloqueado } from "./cadeado";
import { Gerador } from "./gerador";
import { MaterialView, type MaterialIA } from "./material";

export const metadata: Metadata = { title: "Estúdio de IA" };

const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function EstudioPage({
  searchParams,
}: {
  searchParams: Promise<{ perfil?: string; material?: string; tipo?: string; ideia?: string }>;
}) {
  const busca = await searchParams;
  const { membro } = await membroAtual();
  const pode = podeEditarConteudo(membro?.papel);
  const perfis = (await listarPerfisAtivos()).filter((p) => p.grupo === "proprio");
  const perfil = escolherPerfil(perfis, busca.perfil);
  if (!perfil) return <p className="text-muted">Cadastre um perfil próprio para usar o estúdio.</p>;

  const supabase = await createClient();
  const [liberado, ideias, { data: pos }, { data: historico }] = await Promise.all([
    estudioLiberado(),
    listarIdeias(perfil.id),
    supabase.from("posicionamento").select("respostas, pilares").eq("perfil_id", perfil.id).maybeSingle<Posicionamento>(),
    supabase
      .from("materiais_ia")
      .select("id, tipo, saida, status, ideia_id, criado_em, modelo")
      .eq("perfil_id", perfil.id)
      .order("criado_em", { ascending: false })
      .limit(20)
      .returns<MaterialIA[]>(),
  ]);

  const lista = historico ?? [];
  const selecionado = lista.find((m) => m.id === Number(busca.material)) ?? lista[0] ?? null;
  const comp = completudePosicionamento(pos ?? null);
  const tituloIdeia = (id: number | null) => ideias.find((i) => i.id === id)?.titulo ?? null;

  return (
    <div className="grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Estúdio de IA</h1>
          <p className="mt-1 text-muted">Ideias, roteiros e leitura dos posts, escritos com o posicionamento e os números de cada perfil.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {liberado && membro?.papel === "admin" && <BloquearEstudio />}
          <SeletorPerfil perfis={perfis} atual={perfil.handle} base="/estudio" />
        </div>
      </header>

      {!comp.pronto && (
        <p className="rounded-xl border border-warn bg-warn-soft px-4 py-3 text-sm text-warn">
          O posicionamento de @{perfil.handle} está incompleto ({comp.respondidas}/{comp.total} respostas, {comp.pilares} pilares). A IA funciona, mas escreve de forma mais genérica.{" "}
          <Link href={`/estrategia?perfil=${perfil.handle}`} className="font-semibold underline">Completar na Estratégia</Link>
        </p>
      )}

      {!liberado ? (
        <EstudioBloqueado admin={membro?.papel === "admin"} />
      ) : pode ? (
        <Gerador
          key={perfil.id}
          perfil={{ id: perfil.id, handle: perfil.handle }}
          ideias={ideias.map((i) => ({ id: i.id, titulo: i.titulo }))}
          tipoInicial={isTipoGeracao(busca.tipo) ? busca.tipo : "ideias"}
          ideiaInicial={Number(busca.ideia) || null}
        />
      ) : (
        <p className="text-sm text-muted">Seu papel permite ver os materiais, mas não gerar novos.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside aria-label="Histórico" className="grid content-start gap-2">
          <h2 className="font-display text-lg font-extrabold">Histórico</h2>
          {lista.length === 0 ? (
            <p className="text-sm text-muted">Nada gerado ainda para este perfil.</p>
          ) : (
            <ul className="grid gap-1">
              {lista.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/estudio?perfil=${perfil.handle}&material=${m.id}`}
                    aria-current={m.id === selecionado?.id ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm ${m.id === selecionado?.id ? "bg-accent-soft text-accent" : "hover:bg-surface"}`}
                  >
                    <span className="block font-medium">{TIPOS_GERACAO[m.tipo].rotulo}</span>
                    <span className="block text-xs text-muted">
                      {quando.format(new Date(m.criado_em))} · {m.status === "publicado" ? "Aprovado" : "Rascunho"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0 rounded-xl border border-line bg-surface p-5">
          {selecionado ? (
            <>
              <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                <h2 className="font-display text-xl font-extrabold">{TIPOS_GERACAO[selecionado.tipo].rotulo}</h2>
                <span className="text-xs text-muted">
                  {quando.format(new Date(selecionado.criado_em))}
                  {selecionado.modelo ? ` · ${selecionado.modelo}` : ""}
                </span>
              </header>
              <MaterialView
                key={selecionado.id}
                material={selecionado}
                podeEditar={pode}
                ideiaTitulo={tituloIdeia(selecionado.ideia_id)}
                perfilHandle={perfil.handle}
              />
            </>
          ) : (
            <p className="text-muted">Escolha o que gerar acima. O resultado aparece aqui e fica salvo no histórico.</p>
          )}
        </section>
      </div>
    </div>
  );
}
