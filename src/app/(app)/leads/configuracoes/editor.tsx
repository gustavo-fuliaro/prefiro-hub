"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ContextoLeads } from "@/lib/dados-leads";
import {
  colunasDoQuadro, EXIGE_LABEL, formatarDuracao, lerDuracao, papelDaColuna, problemasColunas, separarDuracao,
  type ColunaRascunho, type Exige,
} from "@/lib/leads";
import { salvarEtapas, salvarFunil } from "@/lib/leads-api";
import { botao, botaoPrimario } from "../../planejador/ui";

type Unidade = "horas" | "dias" | "sem";
type Linha = ColunaRascunho & { chave: string; valor: string; unidade: Unidade };
const PAPEL_TEXTO: Record<string, string> = { entrada: "Início", meta: "Meta", futuro: "Retorno" };
const CORES = ["#4ade80", "#a78bfa", "#2dd4bf", "#fbbf24", "#8b5cf6", "#60a5fa", "#f472b6", "#fb923c"];

// Admin monta o funil: colunas, prazo parado em cada uma, o que exige para entrar e qual é a meta.
export function EditorFunil({ ctx, contagem, salvo }: { ctx: ContextoLeads; contagem: Record<number, number>; salvo: boolean }) {
  const router = useRouter();
  const inicial = (): Linha[] =>
    colunasDoQuadro(ctx.etapas).map((e) => ({
      id: e.id, chave: String(e.id), nome: e.nome, cor: e.cor, prazo_h: e.prazo_h, exige: e.exige, meta: e.papel === "meta", ...separarDuracao(e.prazo_h),
    }));
  const vidaIni = separarDuracao(ctx.pipeline.vida_max_h);
  const [linhas, setLinhas] = useState<Linha[]>(inicial);
  const [expira, setExpira] = useState(ctx.pipeline.expira_para_base);
  const [vida, setVida] = useState(vidaIni);
  const [salvando, setSalvando] = useState(false);
  // Depois de salvar a tela recarrega com os dados novos; o aviso vem pelo endereço (?salvo=1).
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(
    salvo ? { tipo: "ok", texto: "Funil salvo. Prazos novos valem para quem entrar na etapa daqui pra frente." } : null,
  );

  const prazos = linhas.map((l) => lerDuracao(l.valor, l.unidade));
  const vidaH = lerDuracao(vida.valor, vida.unidade);
  const colunas: ColunaRascunho[] = linhas.map((l, i) => ({
    id: l.id, nome: l.nome, cor: l.cor, prazo_h: prazos[i] === false ? null : (prazos[i] as number | null), exige: l.exige, meta: l.meta,
  }));
  const problemas = [
    ...problemasColunas(colunas),
    ...(prazos.some((p) => p === false) ? ['Confira os prazos: use um número de 1 hora a 365 dias, ou "sem limite".'] : []),
    ...(vidaH === false ? ['Confira o limite total: de 1 hora a 365 dias, ou "sem limite".'] : []),
  ].filter((p, i, a) => a.indexOf(p) === i);

  // Marcar uma meta desmarca as outras (só uma por funil).
  const muda = (i: number, p: Partial<Linha>) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : p.meta ? { ...l, meta: false } : l)));
  const troca = (i: number, j: number) =>
    setLinhas((ls) => {
      if (j < 0 || j >= ls.length) return ls;
      const n = [...ls];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function salvar() {
    if (problemas.length) return;
    setSalvando(true);
    setAviso(null);
    const r1 = await salvarEtapas(ctx.pipeline.id, colunas.map((c) => ({ ...c, nome: c.nome.trim() })));
    const r2 = r1.erro ? r1 : await salvarFunil(ctx.pipeline.id, { expira_para_base: expira, vida_max_h: vidaH as number | null });
    setSalvando(false);
    if (r2.erro) return setAviso({ tipo: "erro", texto: r2.erro });
    setAviso({ tipo: "ok", texto: "Funil salvo. Prazos novos valem para quem entrar na etapa daqui pra frente." });
    router.replace("/leads/configuracoes?salvo=1");
    router.refresh();
  }

  const campoPeq = "h-9 rounded-md border border-line bg-bg px-2.5 text-sm";
  return (
    <div className="grid max-w-4xl gap-6">
      <section className="grid gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Colunas do quadro · {ctx.pipeline.nome}</h2>
          <p className="text-sm text-muted">O lead sempre começa na primeira coluna. Use as setas para mudar a ordem.</p>
        </div>
        <ol className="grid gap-3">
          {linhas.map((l, i) => {
            const papel = papelDaColuna(l, i);
            const leads = l.id ? (contagem[l.id] ?? 0) : 0;
            return (
              <li key={l.chave} className="grid gap-3 rounded-balao border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="color" aria-label={`Cor de ${l.nome || "nova coluna"}`} value={l.cor} onChange={(e) => muda(i, { cor: e.target.value })} className="h-9 w-10 cursor-pointer rounded-md border border-line bg-bg p-0.5" />
                  <input aria-label="Nome da coluna" value={l.nome} maxLength={40} placeholder="Nome da coluna" onChange={(e) => muda(i, { nome: e.target.value })} className={`${campoPeq} min-w-40 flex-1 font-semibold`} />
                  {PAPEL_TEXTO[papel] && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">{PAPEL_TEXTO[papel]}</span>}
                  <span className="text-xs text-muted">{leads} {leads === 1 ? "lead" : "leads"}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => troca(i, i - 1)} disabled={i === 0} aria-label="Subir coluna" className="grid size-8 place-items-center rounded-md border border-line disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => troca(i, i + 1)} disabled={i === linhas.length - 1} aria-label="Descer coluna" className="grid size-8 place-items-center rounded-md border border-line disabled:opacity-40">↓</button>
                    <button
                      type="button"
                      disabled={leads > 0 || linhas.length <= 2}
                      title={leads > 0 ? "Mova os leads desta coluna antes de remover" : undefined}
                      onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                      className="h-8 rounded-md border border-line px-2 text-xs text-danger disabled:opacity-40"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <fieldset className="grid gap-1 text-sm">
                    <legend className="mb-1 font-medium">{l.exige === "data_retorno" ? "Prazo depois da data de retorno" : "Tempo máximo parado aqui"}</legend>
                    <div className="flex gap-1.5">
                      {l.unidade !== "sem" && (
                        <input aria-label="Prazo" inputMode="decimal" value={l.valor} onChange={(e) => muda(i, { valor: e.target.value })} className={`${campoPeq} w-20`} />
                      )}
                      <select aria-label="Unidade do prazo" value={l.unidade} onChange={(e) => muda(i, { unidade: e.target.value as Unidade, valor: l.valor || "2" })} className={campoPeq}>
                        <option value="horas">horas</option>
                        <option value="dias">dias</option>
                        <option value="sem">sem limite</option>
                      </select>
                    </div>
                  </fieldset>
                  <label className="grid gap-1 text-sm font-medium">
                    Para entrar, precisa de
                    <select value={l.exige} onChange={(e) => muda(i, { exige: e.target.value as Exige })} className={campoPeq}>
                      {(Object.keys(EXIGE_LABEL) as Exige[]).map((x) => (
                        <option key={x} value={x} disabled={i === 0 && x === "data_retorno"}>{EXIGE_LABEL[x]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end text-sm font-medium">
                    <input type="radio" name="meta" checked={l.meta} disabled={i === 0} onChange={() => muda(i, { meta: true })} />
                    É a meta do funil
                  </label>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={linhas.length >= 12}
            onClick={() => setLinhas((ls) => [...ls, { chave: `nova-${Date.now()}`, nome: "", cor: CORES[ls.length % CORES.length], prazo_h: 48, exige: "nada", meta: false, valor: "2", unidade: "dias" }])}
            className={`${botao} border border-line hover:border-accent disabled:opacity-40`}
          >
            + Nova coluna
          </button>
          {linhas.some((l) => l.meta) && <span className="text-xs text-muted">Lead que chega na meta conta como convertido.</span>}
        </div>
        <p className="text-sm text-muted">
          Fora do quadro ficam a <b>Base Geral</b> (lead sem responsável, esperando alguém assumir) e o <b>Desqualificado</b> (descartado; o mesmo @ não pode ser cadastrado de novo).
        </p>
      </section>

      <section className="grid gap-3 rounded-balao border border-line bg-surface p-4 shadow-card">
        <h2 className="font-display text-lg font-bold">Tempo de vida do lead</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={expira} onChange={(e) => setExpira(e.target.checked)} className="mt-1" />
          <span>
            <b>Devolver para a Base Geral quando o prazo vencer.</b>
            <span className="block text-muted">Desligado, nenhum lead expira neste funil: fica com o responsável até alguém mover.</span>
          </span>
        </label>
        <fieldset className="grid gap-1 text-sm" disabled={!expira}>
          <legend className="mb-1 font-medium">Limite total no funil (mesmo andando de etapa; não vale na meta)</legend>
          <div className="flex gap-1.5">
            {vida.unidade !== "sem" && <input aria-label="Limite total" inputMode="decimal" value={vida.valor} onChange={(e) => setVida({ ...vida, valor: e.target.value })} className={`${campoPeq} w-20`} />}
            <select aria-label="Unidade do limite total" value={vida.unidade} onChange={(e) => setVida({ valor: vida.valor || "30", unidade: e.target.value as Unidade })} className={campoPeq}>
              <option value="horas">horas</option>
              <option value="dias">dias</option>
              <option value="sem">sem limite</option>
            </select>
          </div>
        </fieldset>
        {expira && linhas[0] && prazos[0] !== false && (
          <p className="text-sm text-muted">
            Exemplo: um lead que ninguém move fica em {linhas[0].nome || "a primeira coluna"}{" "}
            {prazos[0] === null ? "sem prazo, até alguém mover." : `por ${formatarDuracao(prazos[0] as number)} e volta para a Base Geral sem responsável.`}{" "}
            Nada é apagado: da Base Geral, qualquer pessoa da equipe assume de novo.
          </p>
        )}
      </section>

      {problemas.length > 0 && (
        <ul role="alert" className="grid gap-1 rounded-balao border border-danger/40 bg-danger-soft p-4 text-sm text-danger">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {aviso && <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`text-sm ${aviso.tipo === "erro" ? "text-danger" : "text-ok"}`}>{aviso.texto}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={salvar} disabled={salvando || problemas.length > 0} className={botaoPrimario}>{salvando ? "Salvando…" : "Salvar funil"}</button>
        <button
          type="button"
          onClick={() => {
            setLinhas(inicial());
            setExpira(ctx.pipeline.expira_para_base);
            setVida(vidaIni);
            setAviso(null);
          }}
          className={`${botao} border border-line`}
        >
          Descartar mudanças
        </button>
      </div>
    </div>
  );
}
