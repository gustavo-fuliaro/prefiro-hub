"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { SaidaAnalise, SaidaIdeias, SaidaRoteiro } from "@/lib/estudio";
import { aprovarMaterial, enviarIdeiasAoPlanejador, salvarRoteiroNaIdeia, type Resultado } from "./actions";

export type MaterialIA = {
  id: number;
  tipo: "ideias" | "roteiro" | "analise";
  saida: unknown;
  status: "rascunho" | "publicado";
  ideia_id: number | null;
  criado_em: string;
  modelo: string | null;
};

const botao = "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60";

function Copiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }).catch(() => {})}
      className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent"
    >
      {ok ? "Copiado" : rotulo}
    </button>
  );
}

function textoRoteiro(r: SaidaRoteiro): string {
  if (r.tipo === "carrossel") {
    return [...r.slides.map((s, i) => `Slide ${i + 1}: ${s.titulo}\n${s.texto}`), "", `Legenda:\n${r.legenda}`, r.hashtags.join(" ")].join("\n\n");
  }
  return [
    `GANCHO: ${r.gancho.fala}\n(cena: ${r.gancho.cena}; tela: ${r.gancho.texto_tela})`,
    ...r.blocos.map((b, i) => `BLOCO ${i + 1}: ${b.fala}\n(cena: ${b.cena})`),
    `FECHAMENTO: ${r.fechamento.fala}\n(cena: ${r.fechamento.cena})`,
    `CTA: ${r.cta}`,
    `Legenda:\n${r.legenda}`,
    r.hashtags.join(" "),
  ].join("\n\n");
}

export function MaterialView({ material, podeEditar, ideiaTitulo, perfilHandle }: { material: MaterialIA; podeEditar: boolean; ideiaTitulo: string | null; perfilHandle: string }) {
  const [res, setRes] = useState<Resultado | null>(null);
  const [pendente, iniciar] = useTransition();
  const executar = (f: () => Promise<Resultado>) => iniciar(async () => setRes(await f()));
  const aprovado = material.status === "publicado";

  const aviso = (
    <p aria-live="polite" className="text-sm">
      {res?.erro && <span className="text-danger">{res.erro}</span>}
      {res?.ok && <span className="text-ok">{res.ok}</span>}
    </p>
  );

  if (material.tipo === "ideias") {
    const s = material.saida as SaidaIdeias;
    return <ListaIdeias ideias={s.ideias} materialId={material.id} podeEditar={podeEditar} aprovado={aprovado} perfilHandle={perfilHandle} />;
  }

  if (material.tipo === "roteiro") {
    const r = material.saida as SaidaRoteiro;
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="rounded bg-accent-soft px-2 py-0.5 font-semibold text-accent">{r.tipo === "reel" ? "Reel" : "Carrossel"}</span>
          {r.duracao_estimada && <span>{r.duracao_estimada}</span>}
          {ideiaTitulo && <span>· Ideia: {ideiaTitulo}</span>}
        </div>
        {r.tipo === "reel" ? (
          <ol className="grid gap-3">
            <li className="rounded-lg border-l-4 border-accent bg-bg p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">Gancho</div>
              <p className="mt-1 font-medium">“{r.gancho.fala}”</p>
              <p className="mt-1 text-sm text-muted">Cena: {r.gancho.cena}</p>
              {r.gancho.texto_tela && <p className="text-sm text-muted">Texto na tela: {r.gancho.texto_tela}</p>}
            </li>
            {r.blocos.map((b, i) => (
              <li key={i} className="rounded-lg border-l-4 border-line bg-bg p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Bloco {i + 1}</div>
                <p className="mt-1">“{b.fala}”</p>
                <p className="mt-1 text-sm text-muted">Cena: {b.cena}</p>
              </li>
            ))}
            <li className="rounded-lg border-l-4 border-line bg-bg p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Fechamento</div>
              <p className="mt-1">“{r.fechamento.fala}”</p>
              <p className="mt-1 text-sm text-muted">Cena: {r.fechamento.cena}</p>
            </li>
            <li className="rounded-lg border-l-4 border-ok bg-bg p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ok">Chamada</div>
              <p className="mt-1">“{r.cta}”</p>
            </li>
          </ol>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {r.slides.map((s, i) => (
              <li key={i} className="rounded-lg border border-line bg-bg p-3">
                <div className="text-xs font-semibold text-muted">{i === 0 ? "Capa" : `Slide ${i + 1}`}</div>
                <p className="font-semibold">{s.titulo}</p>
                <p className="mt-1 whitespace-pre-line text-sm">{s.texto}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-lg bg-bg p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Legenda</div>
          <p className="mt-1 whitespace-pre-line text-sm">{r.legenda}</p>
          <p className="mt-2 text-sm text-accent">{r.hashtags.join(" ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && material.ideia_id && (
            <button type="button" disabled={pendente} onClick={() => executar(() => salvarRoteiroNaIdeia(material.id))} className={botao}>
              {aprovado ? "Salvar de novo na ideia" : "Salvar roteiro na ideia"}
            </button>
          )}
          <Copiar texto={textoRoteiro(r)} rotulo="Copiar roteiro" />
          <Copiar texto={`${r.legenda}\n\n${r.hashtags.join(" ")}`} rotulo="Copiar legenda" />
          {material.ideia_id && (
            <Link href={`/briefings?perfil=${perfilHandle}#ideia-${material.ideia_id}`} className="text-sm text-accent hover:underline">Abrir briefing</Link>
          )}
        </div>
        {aviso}
      </div>
    );
  }

  const a = material.saida as SaidaAnalise;
  return (
    <div className="grid gap-4">
      <p className="whitespace-pre-line">{a.resumo}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {a.padroes.map((p, i) => (
          <div key={i} className="rounded-lg border border-line bg-bg p-3">
            <div className="font-semibold">{p.titulo}</div>
            <p className="mt-1 text-sm text-muted">{p.evidencia}</p>
            <p className="mt-2 text-sm"><span className="font-semibold">Recomendação:</span> {p.recomendacao}</p>
          </div>
        ))}
      </div>
      {a.formatos_que_funcionam.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Formatos que funcionam</div>
          <ul className="mt-1 flex flex-wrap gap-2">
            {a.formatos_que_funcionam.map((f) => <li key={f} className="rounded bg-accent-soft px-2 py-0.5 text-sm text-accent">{f}</li>)}
          </ul>
        </div>
      )}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Próximos testes</div>
        <ol className="mt-1 list-decimal pl-5 text-sm">
          {a.proximos_testes.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      </div>
      {podeEditar && !aprovado && (
        <button type="button" disabled={pendente} onClick={() => executar(() => aprovarMaterial(material.id))} className={`${botao} justify-self-start`}>
          Marcar como aprovado
        </button>
      )}
      {aviso}
    </div>
  );
}

function ListaIdeias({ ideias, materialId, podeEditar, aprovado, perfilHandle }: { ideias: SaidaIdeias["ideias"]; materialId: number; podeEditar: boolean; aprovado: boolean; perfilHandle: string }) {
  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set(ideias.map((_, i) => i)));
  const [res, setRes] = useState<Resultado | null>(null);
  const [pendente, iniciar] = useTransition();
  const alternar = (i: number) => setMarcadas((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="grid gap-3">
      <ul className="grid gap-2">
        {ideias.map((i, n) => (
          <li key={n} className="flex gap-3 rounded-lg border border-line bg-bg p-3">
            {podeEditar && (
              <input id={`ideia-ia-${n}`} type="checkbox" checked={marcadas.has(n)} onChange={() => alternar(n)} className="mt-1 size-4 accent-[var(--accent)]" aria-label={`Selecionar ${i.titulo}`} />
            )}
            <div className="min-w-0">
              <div className="font-semibold">{i.titulo}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">{i.formato}</span>
                {i.pilar && <span className="rounded border border-line px-1.5 py-0.5 text-muted">{i.pilar}</span>}
              </div>
              <p className="mt-1 text-sm"><span className="font-semibold">Gancho:</span> {i.gancho}</p>
              <p className="mt-1 text-sm text-muted">{i.tese}</p>
              <p className="mt-1 text-sm"><span className="font-semibold">CTA:</span> {i.cta}</p>
              <p className="mt-1 text-xs text-muted">Por quê: {i.por_que}</p>
            </div>
          </li>
        ))}
      </ul>
      {podeEditar && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={pendente || !marcadas.size}
            onClick={() => iniciar(async () => setRes(await enviarIdeiasAoPlanejador(materialId, [...marcadas])))}
            className={botao}
          >
            {pendente ? "Enviando…" : `Enviar ${marcadas.size} ao planejador`}
          </button>
          {aprovado && <span className="text-sm text-muted">Já enviado antes. Enviar de novo cria cópias.</span>}
          {res?.ok && <Link href={`/planejador?perfil=${perfilHandle}`} className="text-sm text-accent hover:underline">Abrir planejador</Link>}
        </div>
      )}
      <p aria-live="polite" className="text-sm">
        {res?.erro && <span className="text-danger">{res.erro}</span>}
        {res?.ok && <span className="text-ok">{res.ok}</span>}
      </p>
    </div>
  );
}
