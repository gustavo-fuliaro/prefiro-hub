"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FormularioPublicoView } from "@/components/formulario-publico";
import { IconeAnterior, IconeLixeira, IconeMais } from "@/components/icones";
import type { ContextoLeads } from "@/lib/dados-leads";
import {
  baseParaCondicao, ehTela, lerSlug, limparCondicoes, novaPergunta, novoId, OPERADORES, problemasFormulario, ROTULO_TIPO, TEM_OPCOES, TIPOS,
  type Condicao, type Formulario, type Operador, type Pergunta, type TipoPergunta,
} from "@/lib/formularios";
import { publicarFormulario, salvarFormulario } from "@/lib/formularios-api";
import { colunasDoQuadro } from "@/lib/leads";
import { botao, botaoPrimario } from "../../planejador/ui";
import { situacao } from "../lista";

type Painel = { tipo: "pergunta"; id: string } | { tipo: "config" } | { tipo: "aparencia" } | { tipo: "final" };
const campo = "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm";
const rotulo = "grid gap-1 text-sm font-medium";

export function EditorFormulario({ ctx, inicial }: { ctx: ContextoLeads; inicial: Formulario }) {
  const [salvo, setSalvo] = useState(inicial);
  const [f, setF] = useState(inicial);
  const [painel, setPainel] = useState<Painel>(inicial.perguntas[0] ? { tipo: "pergunta", id: inicial.perguntas[0].id } : { tipo: "config" });
  const [aba, setAba] = useState<"perguntas" | "previa" | "propriedades">("perguntas");
  const [chavePrevia, setChavePrevia] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string; itens?: string[] } | null>(null);

  const sujo = JSON.stringify(f) !== JSON.stringify(salvo);
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (sujo) e.preventDefault();
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [sujo]);

  const etapa = ctx.etapas.find((e) => e.id === f.etapa_id) ?? null;
  const problemas = useMemo(() => problemasFormulario(f, etapa), [f, etapa]);
  const muda = (p: Partial<Formulario>) => setF((x) => ({ ...x, ...p }));
  const mudaPergunta = (id: string, p: Partial<Pergunta>) => setF((x) => ({ ...x, perguntas: x.perguntas.map((q) => (q.id === id ? { ...q, ...p } : q)) }));
  const setPerguntas = (lista: Pergunta[]) => setF((x) => ({ ...x, perguntas: limparCondicoes(lista) }));
  const s = situacao(salvo);

  function adicionar(tipo: TipoPergunta) {
    const nova = novaPergunta(tipo);
    const i = painel.tipo === "pergunta" ? f.perguntas.findIndex((q) => q.id === painel.id) : f.perguntas.length - 1;
    const lista = [...f.perguntas];
    // Boas-vindas vai para o começo; as demais entram depois da selecionada.
    lista.splice(tipo === "boas_vindas" ? 0 : i + 1, 0, nova);
    setPerguntas(lista);
    setPainel({ tipo: "pergunta", id: nova.id });
  }

  async function salvar(): Promise<Formulario | null> {
    const slug = lerSlug(f.slug);
    if (!slug) {
      setAviso({ tipo: "erro", texto: "O endereço precisa ter de 3 a 40 letras, números ou hífens." });
      return null;
    }
    setOcupado(true);
    const r = await salvarFormulario(f.id, {
      titulo: f.titulo.trim() || "Sem título", descricao: f.descricao?.trim() || null, slug, modo: f.modo, tema: f.tema,
      perguntas: limparCondicoes(f.perguntas), final: f.final, pipeline_id: f.pipeline_id, etapa_id: f.pipeline_id ? f.etapa_id : null,
      responsavel: f.responsavel, perfil_id: f.perfil_id, etiqueta: f.etiqueta?.trim() || null,
    });
    setOcupado(false);
    if (r.erro) {
      setAviso({ tipo: "erro", texto: r.erro });
      return null;
    }
    setSalvo(r.ok!);
    setF(r.ok!);
    return r.ok!;
  }

  async function publicar() {
    const ok = await salvar();
    if (!ok) return;
    setOcupado(true);
    const r = await publicarFormulario(ok.id);
    setOcupado(false);
    if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
    if (r.ok!.length) return setAviso({ tipo: "erro", texto: "Antes de publicar, resolva:", itens: r.ok! });
    const atual = { ...ok, publicado: { titulo: ok.titulo, descricao: ok.descricao, modo: ok.modo, tema: ok.tema, perguntas: ok.perguntas, final: ok.final }, publicado_em: new Date().toISOString() };
    setSalvo(atual);
    setF(atual);
    setAviso({ tipo: "ok", texto: `No ar em ${window.location.origin}/f/${ok.slug}` });
  }

  const selecionada = painel.tipo === "pergunta" ? f.perguntas.find((q) => q.id === painel.id) : undefined;
  const indiceSel = selecionada ? f.perguntas.indexOf(selecionada) : -1;
  const numeros = new Map(f.perguntas.filter((q) => !ehTela(q)).map((q, i) => [q.id, i + 1]));

  const listaPerguntas = (
    <section aria-label="Perguntas" className="grid content-start gap-2">
      <ol className="grid gap-1.5">
        {f.perguntas.map((q, i) => {
          const ativa = painel.tipo === "pergunta" && painel.id === q.id;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => { setPainel({ tipo: "pergunta", id: q.id }); setAba("propriedades"); }}
                aria-current={ativa || undefined}
                className={`grid w-full gap-0.5 rounded-md border px-3 py-2 text-left text-sm ${ativa ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"}`}
              >
                <span className="flex items-center gap-2 text-[11px] font-semibold text-muted">
                  {numeros.get(q.id) ? `${numeros.get(q.id)}.` : "Tela"} {ROTULO_TIPO[q.tipo]}
                  {q.obrigatoria && !ehTela(q) && <span title="Obrigatória">*</span>}
                  {q.condicao?.regras?.length ? <span className="rounded bg-lane px-1">condicional</span> : null}
                  {q.qualificacao?.ativa ? <span className="rounded bg-lane px-1">qualifica</span> : null}
                </span>
                <span className="line-clamp-2">{q.titulo || <i className="text-muted">Sem título</i>}</span>
              </button>
              {ativa && (
                <div className="mt-1 flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => { const l = [...f.perguntas]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setPerguntas(l); }} className="h-7 rounded border border-line px-2 text-xs disabled:opacity-40" aria-label="Subir pergunta">↑</button>
                  <button type="button" disabled={i === f.perguntas.length - 1} onClick={() => { const l = [...f.perguntas]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; setPerguntas(l); }} className="h-7 rounded border border-line px-2 text-xs disabled:opacity-40" aria-label="Descer pergunta">↓</button>
                  <button type="button" onClick={() => { const c = { ...structuredClone(q), id: novoId() }; const l = [...f.perguntas]; l.splice(i + 1, 0, c); setPerguntas(l); setPainel({ tipo: "pergunta", id: c.id }); }} className="h-7 rounded border border-line px-2 text-xs">Duplicar</button>
                  <button type="button" onClick={() => { const l = f.perguntas.filter((x) => x.id !== q.id); setPerguntas(l); setPainel(l[Math.max(0, i - 1)] ? { tipo: "pergunta", id: l[Math.max(0, i - 1)].id } : { tipo: "config" }); }} className="ml-auto grid h-7 place-items-center rounded border border-line px-2 text-danger" aria-label="Excluir pergunta">
                    <IconeLixeira className="size-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <AdicionarPergunta aoEscolher={adicionar} />
      <div className="mt-2 grid gap-1.5 border-t border-line pt-3">
        {([["final", "Tela final e isca"], ["config", "Configurações e funil"], ["aparencia", "Aparência"]] as const).map(([t, r]) => (
          <button key={t} type="button" onClick={() => { setPainel({ tipo: t }); setAba("propriedades"); }}
            className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${painel.tipo === t ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"}`}>
            {r}
          </button>
        ))}
      </div>
    </section>
  );

  const previa = (
    <section aria-label="Prévia" className="grid content-start gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>Prévia (nada é gravado)</span>
        <button type="button" onClick={() => setChavePrevia((k) => k + 1)} className="underline-offset-2 hover:underline">Recomeçar prévia</button>
      </div>
      <div className="h-[560px] overflow-y-auto rounded-balao border border-line shadow-card">
        <FormularioPublicoView key={chavePrevia} previa form={{ slug: f.slug, titulo: f.titulo, descricao: f.descricao, modo: f.modo, tema: f.tema, perguntas: f.perguntas, final: f.final }} />
      </div>
    </section>
  );

  const propriedades = (
    <section aria-label="Propriedades" className="grid content-start gap-4 rounded-balao border border-line bg-surface p-4 shadow-card">
      {selecionada && <PropsPergunta key={selecionada.id} q={selecionada} anteriores={baseParaCondicao(f.perguntas, indiceSel)} muda={(p) => mudaPergunta(selecionada.id, p)} />}
      {painel.tipo === "config" && <PropsConfig ctx={ctx} f={f} muda={muda} />}
      {painel.tipo === "aparencia" && <PropsAparencia f={f} muda={muda} />}
      {painel.tipo === "final" && <PropsFinal f={f} muda={muda} />}
    </section>
  );

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <Link href="/iscas-digitais" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-ink"><IconeAnterior /> Iscas Digitais</Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{f.titulo || "Sem título"}</h1>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.classe}`}>{s.rotulo}</span>
            {sujo && <span className="text-xs text-warn">Alterações não salvas</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/iscas-digitais/${f.id}/respostas`} className={`${botao} h-10 border border-line hover:border-accent`}>Respostas</Link>
          <button type="button" disabled={ocupado || !sujo} onClick={async () => { if (await salvar()) setAviso({ tipo: "ok", texto: "Rascunho salvo. O que está no ar só muda quando você publicar." }); }} className={`${botao} h-10 border border-line hover:border-accent disabled:opacity-50`}>
            Salvar rascunho
          </button>
          <button type="button" disabled={ocupado} onClick={publicar} className={botaoPrimario}>{ocupado ? "Aguarde…" : "Publicar"}</button>
        </div>
      </header>

      {aviso && (
        <div role={aviso.tipo === "erro" ? "alert" : "status"} className={`rounded-md px-4 py-2 text-sm ${aviso.tipo === "erro" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`}>
          {aviso.texto}
          {aviso.itens && <ul className="mt-1 list-disc pl-5">{aviso.itens.map((i) => <li key={i}>{i}</li>)}</ul>}
        </div>
      )}
      {problemas.length > 0 && !aviso?.itens && (
        <details className="rounded-md border border-warn/40 bg-warn-soft px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-warn">{problemas.length} {problemas.length === 1 ? "ponto" : "pontos"} para resolver antes de publicar</summary>
          <ul className="mt-1 list-disc pl-5">{problemas.map((p) => <li key={p}>{p}</li>)}</ul>
        </details>
      )}

      <nav aria-label="Partes do editor" className="flex gap-1 rounded-balao-sm border border-line bg-surface p-1 text-sm xl:hidden">
        {(["perguntas", "previa", "propriedades"] as const).map((a) => (
          <button key={a} type="button" aria-pressed={aba === a} onClick={() => setAba(a)} className={`flex-1 rounded-md px-3 py-1.5 ${aba === a ? "bg-accent font-semibold text-accent-ink" : "text-muted"}`}>
            {a === "perguntas" ? "Perguntas" : a === "previa" ? "Prévia" : "Propriedades"}
          </button>
        ))}
      </nav>
      <div className="hidden gap-4 xl:grid xl:grid-cols-[250px_minmax(0,1fr)_340px]">
        {listaPerguntas}
        {previa}
        {propriedades}
      </div>
      <div className="xl:hidden">{aba === "perguntas" ? listaPerguntas : aba === "previa" ? previa : propriedades}</div>
    </div>
  );
}

function AdicionarPergunta({ aoEscolher }: { aoEscolher: (t: TipoPergunta) => void }) {
  const [aberto, setAberto] = useState(false);
  const grupos = [...new Set(TIPOS.map((t) => t.grupo))];
  return (
    <div className="grid gap-2">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className={`${botao} justify-center border border-dashed border-line-strong hover:border-accent`}>
        <IconeMais /> Adicionar
      </button>
      {aberto && (
        <div className="grid gap-2 rounded-md border border-line bg-surface p-2">
          {grupos.map((g) => (
            <div key={g} className="grid gap-1">
              <span className="px-1 text-[11px] font-semibold text-muted uppercase">{g}</span>
              <div className="flex flex-wrap gap-1">
                {TIPOS.filter((t) => t.grupo === g).map((t) => (
                  <button key={t.tipo} type="button" onClick={() => { aoEscolher(t.tipo); setAberto(false); }} className="rounded-md border border-line px-2 py-1 text-xs hover:border-accent">
                    {t.rotulo}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Interruptor({ ligado, aoMudar, children }: { ligado: boolean; aoMudar: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm font-medium">
      {children}
      <input type="checkbox" checked={ligado} onChange={(e) => aoMudar(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
    </label>
  );
}

function PropsPergunta({ q, anteriores, muda }: { q: Pergunta; anteriores: Pergunta[]; muda: (p: Partial<Pergunta>) => void }) {
  const tela = ehTela(q);
  const temOpcoes = TEM_OPCOES.includes(q.tipo);
  const opcoes = q.opcoes ?? [];
  const qual = q.qualificacao ?? { ativa: false, qualifica: opcoes.map(() => false) };
  const mudaOpcoes = (ops: string[], qualifica = qual.qualifica) =>
    muda({ opcoes: ops, qualificacao: { ...qual, qualifica: ops.map((_, i) => qualifica[i] ?? false) } });

  return (
    <div className="grid gap-4">
      <h2 className="font-display text-base font-bold">{ROTULO_TIPO[q.tipo]}</h2>
      <label className={rotulo}>
        {tela ? "Título" : q.tipo === "termos" ? "Texto do aceite" : "Pergunta"}
        <textarea rows={2} value={q.titulo} maxLength={300} onChange={(e) => muda({ titulo: e.target.value })} className={campo} />
      </label>
      <label className={rotulo}>
        Descrição <span className="font-normal text-muted">(opcional)</span>
        <textarea rows={2} value={q.descricao ?? ""} maxLength={600} onChange={(e) => muda({ descricao: e.target.value || undefined })} className={campo} />
      </label>
      {tela ? (
        <label className={rotulo}>
          Texto do botão
          <input value={q.botao ?? ""} maxLength={30} onChange={(e) => muda({ botao: e.target.value })} className={campo} />
        </label>
      ) : (
        <Interruptor ligado={!!q.obrigatoria} aoMudar={(v) => muda({ obrigatoria: v })}>Obrigatória</Interruptor>
      )}
      {["texto_curto", "texto_longo", "numero", "moeda"].includes(q.tipo) && (
        <label className={rotulo}>
          Texto de exemplo no campo
          <input value={q.placeholder ?? ""} maxLength={80} onChange={(e) => muda({ placeholder: e.target.value || undefined })} className={campo} />
        </label>
      )}
      {q.tipo === "instagram" && <p className="text-xs text-muted">É pelo @ que a resposta vira lead no funil (e que um lead repetido é reconhecido).</p>}

      {temOpcoes && (
        <div className="grid gap-2">
          <span className="text-sm font-medium">Opções</span>
          {opcoes.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={o} maxLength={150} aria-label={`Opção ${i + 1}`} onChange={(e) => mudaOpcoes(opcoes.map((x, j) => (j === i ? e.target.value : x)))} className={`${campo} flex-1`} />
              {qual.ativa && (
                <label className="flex items-center gap-1 text-xs" title="Quem escolhe esta opção é qualificado">
                  <input type="checkbox" checked={!!qual.qualifica[i]} onChange={(e) => muda({ qualificacao: { ...qual, qualifica: opcoes.map((_, j) => (j === i ? e.target.checked : !!qual.qualifica[j])) } })} />
                  qualifica
                </label>
              )}
              <button type="button" disabled={opcoes.length <= 2} onClick={() => mudaOpcoes(opcoes.filter((_, j) => j !== i), qual.qualifica.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded border border-line text-danger disabled:opacity-40" aria-label={`Remover opção ${i + 1}`}>
                <IconeLixeira className="size-3.5" />
              </button>
            </div>
          ))}
          <button type="button" disabled={opcoes.length >= 30} onClick={() => mudaOpcoes([...opcoes, `Opção ${opcoes.length + 1}`])} className={`${botao} w-fit border border-line hover:border-accent`}>+ Opção</button>
          <Interruptor ligado={qual.ativa} aoMudar={(v) => muda({ qualificacao: { ativa: v, qualifica: opcoes.map((_, i) => !!qual.qualifica[i]) }, ...(v ? { obrigatoria: true } : {}) })}>
            Pergunta de qualificação
          </Interruptor>
          {qual.ativa && <p className="text-xs text-muted">Marque as opções que qualificam. O lead recebe a etiqueta &ldquo;qualificado&rdquo; ou &ldquo;não qualificado&rdquo;.</p>}
        </div>
      )}

      {q.tipo === "escala" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={rotulo}>De<input type="number" min={0} max={9} value={q.escala?.min ?? 0} onChange={(e) => muda({ escala: { ...(q.escala ?? { max: 10 }), min: Math.max(0, Math.min(9, Number(e.target.value))) } })} className={campo} /></label>
          <label className={rotulo}>Até<input type="number" min={1} max={10} value={q.escala?.max ?? 10} onChange={(e) => muda({ escala: { ...(q.escala ?? { min: 0 }), max: Math.max(1, Math.min(10, Number(e.target.value))) } })} className={campo} /></label>
          <label className={rotulo}>Legenda do início<input value={q.escala?.rotulo_min ?? ""} maxLength={30} onChange={(e) => muda({ escala: { min: q.escala?.min ?? 0, max: q.escala?.max ?? 10, ...q.escala, rotulo_min: e.target.value } })} className={campo} /></label>
          <label className={rotulo}>Legenda do fim<input value={q.escala?.rotulo_max ?? ""} maxLength={30} onChange={(e) => muda({ escala: { min: q.escala?.min ?? 0, max: q.escala?.max ?? 10, ...q.escala, rotulo_max: e.target.value } })} className={campo} /></label>
        </div>
      )}

      <EditorCondicao q={q} anteriores={anteriores} muda={(c) => muda({ condicao: c })} />
    </div>
  );
}

function EditorCondicao({ q, anteriores, muda }: { q: Pergunta; anteriores: Pergunta[]; muda: (c: Condicao | null) => void }) {
  const c = q.condicao ?? null;
  if (!anteriores.length) return <p className="border-t border-line pt-3 text-xs text-muted">Lógica de exibição: disponível a partir da segunda pergunta.</p>;
  const regras = c?.regras ?? [];
  const nova = () => ({ pergunta: anteriores[anteriores.length - 1].id, operador: "igual" as Operador, valor: "" });
  return (
    <div className="grid gap-2 border-t border-line pt-3">
      <span className="text-sm font-medium">Lógica de exibição</span>
      {!regras.length ? (
        <>
          <p className="text-xs text-muted">Sempre aparece. Adicione uma regra para mostrar esta pergunta só quando uma resposta anterior combinar.</p>
          <button type="button" onClick={() => muda({ logica: "e", regras: [nova()] })} className={`${botao} w-fit border border-line hover:border-accent`}>+ Regra</button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">Mostrar só se</p>
          {regras.map((r, i) => {
            const base = anteriores.find((p) => p.id === r.pergunta);
            const semValor = OPERADORES.find((o) => o.op === r.operador)?.semValor;
            const mudaRegra = (p: Partial<typeof r>) => muda({ logica: c!.logica, regras: regras.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="grid gap-1.5 rounded-md border border-line p-2">
                {i > 0 && (
                  <select aria-label="Como combinar as regras" value={c!.logica} onChange={(e) => muda({ logica: e.target.value as "e" | "ou", regras })} className="h-8 w-fit rounded border border-line bg-bg px-2 text-xs font-semibold">
                    <option value="e">E também</option>
                    <option value="ou">OU</option>
                  </select>
                )}
                <select aria-label="Pergunta da regra" value={r.pergunta} onChange={(e) => mudaRegra({ pergunta: e.target.value, valor: "" })} className={campo}>
                  {anteriores.map((p) => <option key={p.id} value={p.id}>{p.titulo || ROTULO_TIPO[p.tipo]}</option>)}
                </select>
                <select aria-label="Condição" value={r.operador} onChange={(e) => mudaRegra({ operador: e.target.value as Operador })} className={campo}>
                  {OPERADORES.map((o) => <option key={o.op} value={o.op}>{o.rotulo}</option>)}
                </select>
                {!semValor &&
                  (base && TEM_OPCOES.includes(base.tipo) ? (
                    <select aria-label="Valor" value={r.valor} onChange={(e) => mudaRegra({ valor: e.target.value })} className={campo}>
                      <option value="">Escolha a opção…</option>
                      {(base.opcoes ?? []).map((o, k) => <option key={k} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input aria-label="Valor" value={r.valor} maxLength={150} onChange={(e) => mudaRegra({ valor: e.target.value })} className={campo} placeholder="Valor" />
                  ))}
                <button type="button" onClick={() => { const resto = regras.filter((_, j) => j !== i); muda(resto.length ? { logica: c!.logica, regras: resto } : null); }} className="w-fit text-xs text-danger hover:underline">
                  Remover regra
                </button>
              </div>
            );
          })}
          <button type="button" disabled={regras.length >= 10} onClick={() => muda({ logica: c!.logica, regras: [...regras, nova()] })} className={`${botao} w-fit border border-line hover:border-accent`}>+ Regra</button>
          {q.obrigatoria && <p className="text-xs text-muted">Quando escondida, a pergunta não é cobrada.</p>}
        </>
      )}
    </div>
  );
}

function PropsConfig({ ctx, f, muda }: { ctx: ContextoLeads; f: Formulario; muda: (p: Partial<Formulario>) => void }) {
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const etapas = colunasDoQuadro(ctx.etapas).filter((e) => e.papel !== "futuro" && e.exige !== "justificativa" && e.exige !== "data_retorno");
  return (
    <div className="grid gap-4">
      <h2 className="font-display text-base font-bold">Configurações</h2>
      <label className={rotulo}>Título<input value={f.titulo} maxLength={120} onChange={(e) => muda({ titulo: e.target.value })} className={campo} /></label>
      <label className={rotulo}>
        Descrição <span className="font-normal text-muted">(aparece na prévia do link)</span>
        <textarea rows={2} value={f.descricao ?? ""} maxLength={500} onChange={(e) => muda({ descricao: e.target.value || null })} className={campo} />
      </label>
      <label className={rotulo}>
        Endereço
        <div className="flex items-center gap-1 text-xs text-muted">
          <span className="shrink-0">{origem}/f/</span>
          <input value={f.slug} maxLength={40} onChange={(e) => muda({ slug: e.target.value.toLowerCase() })} className={`${campo} font-mono`} />
        </div>
      </label>
      <fieldset className="grid gap-1 text-sm">
        <legend className="mb-1 font-medium">Como mostrar</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={f.modo === "passo"} onChange={() => muda({ modo: "passo" })} /> Uma pergunta por tela (estilo Typeform)</label>
        <label className="flex items-center gap-2"><input type="radio" checked={f.modo === "lista"} onChange={() => muda({ modo: "lista" })} /> Todas em uma página</label>
      </fieldset>

      <div className="grid gap-3 border-t border-line pt-3">
        <Interruptor
          ligado={!!f.pipeline_id}
          aoMudar={(v) => muda(v ? { pipeline_id: ctx.pipeline.id, etapa_id: etapas[0]?.id ?? null } : { pipeline_id: null, etapa_id: null })}
        >
          Criar lead no funil {ctx.pipeline.nome}
        </Interruptor>
        {f.pipeline_id && (
          <>
            <label className={rotulo}>
              Etapa de entrada
              <select value={f.etapa_id ?? ""} onChange={(e) => muda({ etapa_id: Number(e.target.value) || null })} className={campo}>
                <option value="">Escolha…</option>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.exige === "contato" ? " (pede telefone e e-mail)" : ""}</option>)}
              </select>
            </label>
            <label className={rotulo}>
              Responsável pelos leads
              <select value={f.responsavel ?? ""} onChange={(e) => muda({ responsavel: e.target.value || null })} className={campo}>
                <option value="">Ninguém (qualquer pessoa da equipe assume)</option>
                {ctx.membros.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
              </select>
            </label>
            <label className={rotulo}>
              Etiqueta do lead <span className="font-normal text-muted">(vazio = título do formulário)</span>
              <input value={f.etiqueta ?? ""} maxLength={40} onChange={(e) => muda({ etiqueta: e.target.value || null })} className={campo} />
            </label>
            <p className="text-xs text-muted">Se o @ já for um lead, ele não muda de etapa nem de responsável: ganha a etiqueta, os dados que faltavam e uma nota com as respostas.</p>
          </>
        )}
        {ctx.perfis.length > 0 && (
          <label className={rotulo}>
            Perfil da isca
            <select value={f.perfil_id ?? ""} onChange={(e) => muda({ perfil_id: Number(e.target.value) || null })} className={campo}>
              <option value="">Nenhum</option>
              {ctx.perfis.map((p) => <option key={p.id} value={p.id}>@{p.handle}</option>)}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

function PropsAparencia({ f, muda }: { f: Formulario; muda: (p: Partial<Formulario>) => void }) {
  return (
    <div className="grid gap-4">
      <h2 className="font-display text-base font-bold">Aparência</h2>
      <label className="flex items-center justify-between gap-3 text-sm font-medium">
        Cor dos botões e destaques
        <input type="color" value={f.tema.cor ?? "#f47c20"} onChange={(e) => muda({ tema: { ...f.tema, cor: e.target.value } })} className="h-9 w-12 cursor-pointer rounded border border-line bg-bg p-0.5" />
      </label>
      <fieldset className="grid gap-1 text-sm">
        <legend className="mb-1 font-medium">Fundo</legend>
        <label className="flex items-center gap-2"><input type="radio" checked={f.tema.fundo !== "claro"} onChange={() => muda({ tema: { ...f.tema, fundo: "escuro" } })} /> Escuro</label>
        <label className="flex items-center gap-2"><input type="radio" checked={f.tema.fundo === "claro"} onChange={() => muda({ tema: { ...f.tema, fundo: "claro" } })} /> Claro</label>
      </fieldset>
    </div>
  );
}

function PropsFinal({ f, muda }: { f: Formulario; muda: (p: Partial<Formulario>) => void }) {
  const fin = f.final ?? {};
  const linkRuim = !!fin.link && !/^https?:\/\/\S+$/.test(fin.link);
  return (
    <div className="grid gap-4">
      <h2 className="font-display text-base font-bold">Tela final</h2>
      <label className={rotulo}>Título<input value={fin.titulo ?? ""} maxLength={120} placeholder="Obrigado!" onChange={(e) => muda({ final: { ...fin, titulo: e.target.value } })} className={campo} /></label>
      <label className={rotulo}>Texto<textarea rows={3} value={fin.texto ?? ""} maxLength={600} placeholder="Recebemos suas respostas." onChange={(e) => muda({ final: { ...fin, texto: e.target.value } })} className={campo} /></label>
      <label className={rotulo}>
        Link da isca <span className="font-normal text-muted">(PDF, planilha, aula…)</span>
        <input type="url" value={fin.link ?? ""} placeholder="https://" onChange={(e) => muda({ final: { ...fin, link: e.target.value } })} className={campo} />
      </label>
      {linkRuim && <p className="text-xs text-danger">O link precisa começar com http:// ou https://.</p>}
      <label className={rotulo}>Texto do botão<input value={fin.botao ?? ""} maxLength={40} placeholder="Acessar o material" onChange={(e) => muda({ final: { ...fin, botao: e.target.value } })} className={campo} /></label>
      <p className="text-xs text-muted">O link só aparece depois do envio, para quem respondeu.</p>
    </div>
  );
}
