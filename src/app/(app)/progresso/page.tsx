import type { Metadata } from "next";
import Link from "next/link";
import { contextoTarefas } from "@/lib/dados-tarefas";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_TAREFA, type Tarefa } from "@/lib/tarefas";
import { GerarPeriodo, Imprimir } from "./botoes";
import { PainelAoVivo } from "./painel";
import { RelatorioAntigo } from "./relatorio-antigo";
import { RelatorioV2 } from "./relatorio-v2";

export const metadata: Metadata = { title: "Progresso" };
export const dynamic = "force-dynamic";

type Item = {
  id: number;
  tipo: "semanal" | "personalizado";
  semana_inicio: string;
  periodo_inicio: string;
  periodo_fim: string;
  parcial: boolean;
  gerado_em: string;
  formato: number | null;
};

const DIA = 86_400_000;

export default async function ProgressoPage({ searchParams }: { searchParams: Promise<{ relatorio?: string; comparar?: string }> }) {
  const busca = await searchParams;
  const ctx = await contextoTarefas();
  if (!ctx) return null;
  const supabase = await createClient();

  const [{ data: tarefas }, { data: itens }] = await Promise.all([
    supabase.from("tarefas").select(CAMPOS_TAREFA).is("arquivada_em", null).returns<Tarefa[]>(),
    supabase
      .from("relatorios")
      .select("id, tipo, semana_inicio, periodo_inicio, periodo_fim, parcial, gerado_em, formato:dados->formato")
      .order("periodo_fim", { ascending: false })
      .order("id", { ascending: false })
      .limit(80)
      .returns<Item[]>(),
  ]);
  const lista = itens ?? [];
  const semanais = lista.filter((r) => r.tipo === "semanal");
  const personalizados = lista.filter((r) => r.tipo === "personalizado");
  const escolhido = lista.find((r) => r.id === Number(busca.relatorio)) ?? semanais[0] ?? lista[0] ?? null;

  // Comparação padrão: o relatório anterior do mesmo tipo e formato.
  const candidatos = escolhido ? lista.filter((r) => r.id !== escolhido.id && r.formato === escolhido.formato) : [];
  const padrao = escolhido
    ? candidatos.find((r) => r.tipo === escolhido.tipo && r.periodo_fim <= escolhido.periodo_inicio) ?? null
    : null;
  const comparado = candidatos.find((r) => r.id === Number(busca.comparar)) ?? padrao;

  const ids = [escolhido?.id, comparado?.id].filter((x): x is number => !!x);
  const { data: completos } = ids.length
    ? await supabase.from("relatorios").select("id, dados").in("id", ids).returns<{ id: number; dados: unknown }[]>()
    : { data: [] as { id: number; dados: unknown }[] };
  const dadosDe = (id?: number) => completos?.find((c) => c.id === id)?.dados ?? null;

  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: ctx.fuso });
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: ctx.fuso });
  const rotulo = (r: Item) =>
    r.formato === 2
      ? `${dia.format(new Date(r.periodo_inicio))} a ${dia.format(new Date(new Date(r.periodo_fim).getTime() - 1000))}`
      : `${dia.format(new Date(`${r.semana_inicio}T12:00:00Z`))} a ${dia.format(new Date(new Date(r.periodo_fim).getTime() - DIA / 2))}`;
  const dias = escolhido ? Math.max(1, Math.round((Date.parse(escolhido.periodo_fim) - Date.parse(escolhido.periodo_inicio)) / DIA)) : 7;

  const Chip = ({ r }: { r: Item }) => (
    <Link
      href={`/progresso?relatorio=${r.id}`}
      aria-current={r.id === escolhido?.id ? "page" : undefined}
      className={`rounded-full border px-3 py-1 text-sm tabular-nums ${r.id === escolhido?.id ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface hover:border-accent"}`}
    >
      {rotulo(r)}
      {r.formato !== 2 && <span className="text-muted"> (antigo)</span>}
    </Link>
  );

  return (
    <div className="grid max-w-6xl gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Progresso</h1>
          <p className="mt-1 text-muted">A produção da equipe ao vivo e os relatórios: o semanal sai toda sexta às 6h, e você pode gerar um de qualquer período.</p>
        </div>
      </header>

      <div className="print:hidden">
        <PainelAoVivo contaId={ctx.contaId} hoje={ctx.hoje} membros={ctx.membros} iniciais={tarefas ?? []} />
      </div>

      <section aria-labelledby="relatorios" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <h2 id="relatorios" className="font-display text-xl font-bold">Relatórios</h2>
            <p className="text-sm text-muted">Os semanais cobrem de uma sexta às 6h até a seguinte, sem repetir dias. Os de período ficam guardados à parte.</p>
          </div>
          {ctx.podeEditar && <GerarPeriodo hoje={ctx.hoje} />}
        </div>

        <div className="grid gap-3 print:hidden">
          {semanais.length > 0 && (
            <nav aria-label="Relatórios semanais" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-sm font-medium">Semanais</span>
              {semanais.map((r) => (
                <Chip key={r.id} r={r} />
              ))}
            </nav>
          )}
          {personalizados.length > 0 && (
            <nav aria-label="Relatórios por período" className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-sm font-medium">Por período</span>
              {personalizados.map((r) => (
                <Chip key={r.id} r={r} />
              ))}
            </nav>
          )}
        </div>

        {!escolhido ? (
          <div className="rounded-balao border border-dashed border-line px-6 py-10 text-center">
            <p className="font-medium">Nenhum relatório ainda.</p>
            <p className="mt-1 text-sm text-muted">O primeiro semanal sai na próxima sexta às 6h. Você também pode gerar um relatório de um período agora.</p>
          </div>
        ) : (
          <article className="grid gap-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <h3 className="font-display text-2xl font-bold">
                  {escolhido.tipo === "semanal" ? "Semana" : "Período"} de {rotulo(escolhido)}
                </h3>
                <p className="text-xs text-muted">
                  Gerado em {quando.format(new Date(escolhido.gerado_em))}
                  {comparado ? ` · comparado com ${rotulo(comparado)}` : " · sem relatório anterior para comparar"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                {candidatos.length > 0 && (
                  <form className="flex items-center gap-2 text-sm" action="/progresso">
                    <input type="hidden" name="relatorio" value={escolhido.id} />
                    <label htmlFor="comparar" className="text-muted">Comparar com</label>
                    <select id="comparar" name="comparar" defaultValue={comparado?.id ?? ""} className="h-9 rounded-md border border-line bg-surface px-2.5">
                      {candidatos.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.tipo === "semanal" ? "Semana" : "Período"} {rotulo(r)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="h-9 rounded-md border border-line px-3 hover:border-accent">Ver</button>
                  </form>
                )}
                <Imprimir />
              </div>
            </header>

            {escolhido.formato === 2 ? (
              <RelatorioV2 dados={dadosDe(escolhido.id)} anterior={dadosDe(comparado?.id)} dias={dias} />
            ) : (
              <RelatorioAntigo rel={{ dados: dadosDe(escolhido.id) }} anterior={comparado ? { dados: dadosDe(comparado.id) } : null} />
            )}
          </article>
        )}
      </section>
    </div>
  );
}
