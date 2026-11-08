"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ehTela, perguntasVisiveis, problemaResposta, type Final, type FormularioPublico, type Pergunta, type Respostas, type Valor,
} from "@/lib/formularios";
import { createClient } from "@/lib/supabase/client";

// Formulário que o lead responde (estilo Typeform): uma pergunta por tela ou todas em lista,
// Enter avança, respostas salvas sozinhas e retomadas se a pessoa voltar pelo mesmo navegador.
// previa = dentro do editor: nada é gravado.
export function FormularioPublicoView({ form, previa = false }: { form: FormularioPublico; previa?: boolean }) {
  const [respostas, setRespostas] = useState<Respostas>({});
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "respondendo" | "enviando" | "fim" | "indisponivel">(previa ? "respondendo" : "carregando");
  const [final, setFinal] = useState<Final>(form.final);
  const sessao = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = useMemo(() => (previa ? null : createClient()), [previa]);

  const visiveis = useMemo(() => perguntasVisiveis(form.perguntas, respostas), [form.perguntas, respostas]);
  const atual = visiveis[Math.min(passo, Math.max(visiveis.length - 1, 0))];
  const total = visiveis.length;

  // Abre ou retoma a sessão.
  useEffect(() => {
    if (!sb) return;
    const chave = `hub_form_${form.slug}`;
    let id: string | null = null;
    try {
      id = localStorage.getItem(chave);
    } catch {}
    if (!id) {
      id = crypto.randomUUID();
      try {
        localStorage.setItem(chave, id);
      } catch {}
    }
    sessao.current = id;
    const busca = new URLSearchParams(window.location.search);
    const origem = Object.fromEntries([...busca.entries()].filter(([k]) => /^(utm_(source|medium|campaign|content|term)|ref)$/.test(k)));
    sb.rpc("form_iniciar", { p_slug: form.slug, p_sessao: id, p_origem: origem }).then(({ data, error }) => {
      if (error) {
        setEstado("indisponivel");
        setErro(/Muitas tentativas/.test(error.message) ? error.message : "Este formulário não está disponível agora.");
        return;
      }
      const r = data as { respostas: Respostas; concluido: boolean; final?: Final | null };
      if (r.concluido) {
        // Quem já enviou vê de novo a tela final com o link da isca.
        if (r.final) setFinal(r.final);
        return setEstado("fim");
      }
      setRespostas(r.respostas ?? {});
      setEstado("respondendo");
    });
  }, [sb, form.slug]);

  const salvar = useCallback(
    (novas: Respostas) => {
      if (!sb || !sessao.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        sb.rpc("form_salvar", { p_slug: form.slug, p_sessao: sessao.current, p_respostas: novas }).then(() => {});
      }, 1500);
    },
    [sb, form.slug],
  );

  function responder(p: Pergunta, v: Valor) {
    setErro(null);
    setRespostas((r) => {
      const novas = { ...r, [p.id]: v };
      salvar(novas);
      return novas;
    });
  }

  async function enviar(finais: Respostas) {
    const faltando = perguntasVisiveis(form.perguntas, finais).map((p) => [p, problemaResposta(p, finais[p.id])] as const).find(([, e]) => e);
    if (faltando) {
      setPasso(visiveis.findIndex((p) => p.id === faltando[0].id));
      setErro(faltando[1]);
      return;
    }
    if (previa || !sb) {
      setEstado("fim");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setEstado("enviando");
    const { data, error } = await sb.rpc("form_enviar", { p_slug: form.slug, p_sessao: sessao.current, p_respostas: finais });
    const r = data as { ok: boolean; erro?: string; final?: Final } | null;
    if (error || !r?.ok) {
      setEstado("respondendo");
      setErro(r?.erro ?? "Não foi possível enviar. Confira a conexão e tente de novo.");
      return;
    }
    if (r.final) setFinal(r.final);
    setEstado("fim");
  }

  function avancar() {
    if (!atual) return;
    const e = problemaResposta(atual, respostas[atual.id]);
    if (e) return setErro(e);
    setErro(null);
    if (passo >= total - 1) return enviar(respostas);
    setPasso((p) => p + 1);
  }

  const cor = form.tema?.cor && /^#[0-9a-fA-F]{6}$/.test(form.tema.cor) ? form.tema.cor : "#f47c20";
  const claro = form.tema?.fundo === "claro";
  const estilo = {
    "--f-cor": cor,
    "--f-fundo": claro ? "#faf8f5" : "#141414",
    "--f-texto": claro ? "#1c1917" : "#f5f5f4",
    "--f-suave": claro ? "#78716c" : "#a8a29e",
    "--f-borda": claro ? "#d6d3d1" : "#44403c",
  } as React.CSSProperties;

  return (
    <div style={estilo} className={`flex flex-col bg-[var(--f-fundo)] text-[var(--f-texto)] ${previa ? "min-h-full" : "min-h-dvh"}`}>
      {form.modo === "passo" && estado === "respondendo" && total > 0 && (
        <div className="h-1 w-full bg-[var(--f-borda)]" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={total} aria-valuenow={passo}>
          <div className="h-full bg-[var(--f-cor)] transition-[width] duration-300" style={{ width: `${(passo / total) * 100}%` }} />
        </div>
      )}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10 sm:px-8">
        {estado === "carregando" && <p className="text-[var(--f-suave)]">Carregando…</p>}
        {estado === "indisponivel" && (
          <div className="grid gap-2">
            <h1 className="text-2xl font-bold">Formulário indisponível</h1>
            <p className="text-[var(--f-suave)]">{erro}</p>
          </div>
        )}
        {estado === "fim" && <TelaFinal final={final} />}
        {(estado === "respondendo" || estado === "enviando") &&
          (form.modo === "lista" ? (
            <form
              className="grid gap-10"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                enviar(respostas);
              }}
            >
              <header className="grid gap-2">
                <h1 className="text-3xl font-bold">{form.titulo}</h1>
                {form.descricao && <p className="text-[var(--f-suave)]">{form.descricao}</p>}
              </header>
              {visiveis.map((p) => (
                <Bloco key={p.id} p={p} valor={respostas[p.id]} onChange={(v) => responder(p, v)} />
              ))}
              {erro && <p role="alert" className="font-medium text-[#ef4444]">{erro}</p>}
              <button type="submit" disabled={estado === "enviando"} className="h-12 w-fit rounded-lg bg-[var(--f-cor)] px-6 font-semibold text-white disabled:opacity-60">
                {estado === "enviando" ? "Enviando…" : "Enviar"}
              </button>
            </form>
          ) : atual ? (
            <form
              key={atual.id}
              className="grid gap-6 animate-[entra_.25s_ease-out]"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                avancar();
              }}
            >
              <Bloco
                p={atual}
                numero={visiveis.filter((x) => !ehTela(x)).indexOf(atual) + 1}
                valor={respostas[atual.id]}
                autoFocus
                onChange={(v) => responder(atual, v)}
                onEscolha={(v) => {
                  // Escolha única avança sozinha, como no Typeform.
                  const novas = { ...respostas, [atual.id]: v };
                  setTimeout(() => {
                    const vis = perguntasVisiveis(form.perguntas, novas);
                    const i = vis.findIndex((x) => x.id === atual.id);
                    if (i >= vis.length - 1) enviar(novas);
                    else setPasso(i + 1);
                  }, 280);
                }}
              />
              {erro && <p role="alert" className="font-medium text-[#ef4444]">{erro}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={estado === "enviando"} className="h-11 rounded-lg bg-[var(--f-cor)] px-5 font-semibold text-white disabled:opacity-60">
                  {estado === "enviando" ? "Enviando…" : ehTela(atual) ? atual.botao || "Continuar" : passo >= total - 1 ? "Enviar" : "OK"}
                </button>
                {!ehTela(atual) && atual.tipo !== "texto_longo" && <span className="text-sm text-[var(--f-suave)]">ou aperte Enter ↵</span>}
                {passo > 0 && (
                  <button type="button" onClick={() => { setErro(null); setPasso((p) => p - 1); }} className="ml-auto text-sm text-[var(--f-suave)] underline-offset-2 hover:underline">
                    Voltar
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p className="text-[var(--f-suave)]">Este formulário ainda não tem perguntas.</p>
          ))}
      </main>
      <style>{`@keyframes entra{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function TelaFinal({ final }: { final: Final }) {
  const link = final.link && /^https?:\/\//.test(final.link) ? final.link : null;
  return (
    <div className="grid gap-4 animate-[entra_.25s_ease-out]">
      <h1 className="text-3xl font-bold">{final.titulo || "Obrigado!"}</h1>
      <p className="text-lg whitespace-pre-wrap text-[var(--f-suave)]">{final.texto || "Recebemos suas respostas."}</p>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 w-fit items-center rounded-lg bg-[var(--f-cor)] px-6 font-semibold text-white">
          {final.botao || "Acessar o material"}
        </a>
      )}
    </div>
  );
}

const INPUT = "w-full border-b-2 border-[var(--f-borda)] bg-transparent py-2 text-2xl outline-none placeholder:text-[var(--f-borda)] focus:border-[var(--f-cor)]";

function Bloco({
  p, numero, valor, onChange, onEscolha, autoFocus,
}: {
  p: Pergunta;
  numero?: number;
  valor: Valor | undefined;
  onChange: (v: Valor) => void;
  onEscolha?: (v: Valor) => void;
  autoFocus?: boolean;
}) {
  const texto = typeof valor === "string" ? valor : "";
  const lista = Array.isArray(valor) ? valor : [];
  const idCampo = `campo-${p.id}`;

  if (ehTela(p)) {
    return (
      <div className="grid gap-3">
        <h2 className="text-3xl leading-tight font-bold">{p.titulo}</h2>
        {p.descricao && <p className="text-lg whitespace-pre-wrap text-[var(--f-suave)]">{p.descricao}</p>}
      </div>
    );
  }

  const cabecalho = (
    <div className="grid gap-1.5">
      <label htmlFor={idCampo} className="flex gap-2 text-2xl leading-snug font-semibold">
        {numero ? <span className="text-base text-[var(--f-cor)]">{numero}→</span> : null}
        <span>
          {p.titulo}
          {p.obrigatoria && <span aria-hidden className="text-[var(--f-cor)]"> *</span>}
        </span>
      </label>
      {p.descricao && <p className="text-[var(--f-suave)]">{p.descricao}</p>}
    </div>
  );

  if (p.tipo === "escolha_unica" || p.tipo === "multipla_escolha") {
    const multi = p.tipo === "multipla_escolha";
    return (
      <fieldset className="grid gap-4">
        <legend className="sr-only">{p.titulo}</legend>
        {cabecalho}
        {multi && <p className="text-sm text-[var(--f-suave)]">Pode marcar mais de uma.</p>}
        <div className="grid gap-2" role={multi ? "group" : "radiogroup"}>
          {(p.opcoes ?? []).map((o, i) => {
            const marcada = multi ? lista.includes(o) : texto === o;
            return (
              <button
                key={`${o}-${i}`}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={marcada}
                autoFocus={autoFocus && i === 0}
                onClick={() => {
                  if (multi) onChange(marcada ? lista.filter((x) => x !== o) : [...lista, o]);
                  else {
                    onChange(o);
                    onEscolha?.(o);
                  }
                }}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-lg transition-colors ${marcada ? "border-[var(--f-cor)] bg-[color-mix(in_srgb,var(--f-cor)_18%,transparent)]" : "border-[var(--f-borda)] hover:border-[var(--f-cor)]"}`}
              >
                <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded border text-sm font-bold ${marcada ? "border-[var(--f-cor)] bg-[var(--f-cor)] text-white" : "border-[var(--f-borda)]"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {o}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (p.tipo === "escala") {
    const min = p.escala?.min ?? 0;
    const max = p.escala?.max ?? 10;
    const nums = Array.from({ length: Math.max(0, Math.min(max - min, 10)) + 1 }, (_, i) => String(min + i));
    return (
      <fieldset className="grid gap-4">
        <legend className="sr-only">{p.titulo}</legend>
        {cabecalho}
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {nums.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={texto === n} onClick={() => { onChange(n); onEscolha?.(n); }}
              className={`grid size-12 place-items-center rounded-lg border text-lg font-semibold ${texto === n ? "border-[var(--f-cor)] bg-[var(--f-cor)] text-white" : "border-[var(--f-borda)] hover:border-[var(--f-cor)]"}`}>
              {n}
            </button>
          ))}
        </div>
        {(p.escala?.rotulo_min || p.escala?.rotulo_max) && (
          <div className="flex justify-between text-sm text-[var(--f-suave)]">
            <span>{p.escala?.rotulo_min}</span>
            <span>{p.escala?.rotulo_max}</span>
          </div>
        )}
      </fieldset>
    );
  }

  if (p.tipo === "termos") {
    const aceito = texto === "aceito";
    return (
      <div className="grid gap-4">
        <label className="flex cursor-pointer items-start gap-3 text-lg">
          <input id={idCampo} type="checkbox" autoFocus={autoFocus} checked={aceito} onChange={(e) => onChange(e.target.checked ? "aceito" : "")} className="mt-1.5 size-5 accent-[var(--f-cor)]" />
          <span>
            {p.titulo}
            {p.obrigatoria && <span aria-hidden className="text-[var(--f-cor)]"> *</span>}
          </span>
        </label>
        {p.descricao && <p className="text-sm text-[var(--f-suave)]">{p.descricao}</p>}
      </div>
    );
  }

  if (p.tipo === "lista") {
    return (
      <div className="grid gap-4">
        {cabecalho}
        <select id={idCampo} autoFocus={autoFocus} value={texto} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-lg border border-[var(--f-borda)] bg-transparent px-3 text-lg">
          <option value="">Escolha…</option>
          {(p.opcoes ?? []).map((o, i) => (
            <option key={`${o}-${i}`} value={o} className="text-black">{o}</option>
          ))}
        </select>
      </div>
    );
  }

  if (p.tipo === "texto_longo") {
    return (
      <div className="grid gap-4">
        {cabecalho}
        <textarea id={idCampo} autoFocus={autoFocus} rows={4} maxLength={3000} value={texto} placeholder={p.placeholder || "Escreva aqui…"} onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-lg border border-[var(--f-borda)] bg-transparent p-3 text-lg outline-none focus:border-[var(--f-cor)]" />
      </div>
    );
  }

  const config: Record<string, { type: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; placeholder: string; autoComplete?: string }> = {
    nome: { type: "text", placeholder: "Seu nome", autoComplete: "name" },
    email: { type: "email", inputMode: "email", placeholder: "nome@email.com", autoComplete: "email" },
    telefone: { type: "tel", inputMode: "tel", placeholder: "(11) 99999-0000", autoComplete: "tel" },
    instagram: { type: "text", placeholder: "@seuperfil", autoComplete: "off" },
    cpf: { type: "text", inputMode: "numeric", placeholder: "000.000.000-00" },
    cnpj: { type: "text", inputMode: "numeric", placeholder: "00.000.000/0000-00" },
    numero: { type: "text", inputMode: "decimal", placeholder: "0" },
    moeda: { type: "text", inputMode: "decimal", placeholder: "R$ 0,00" },
    data: { type: "date", placeholder: "" },
  };
  const c = config[p.tipo] ?? { type: "text", placeholder: "Sua resposta" };
  return (
    <div className="grid gap-4">
      {cabecalho}
      <input id={idCampo} autoFocus={autoFocus} type={c.type} inputMode={c.inputMode} autoComplete={c.autoComplete} maxLength={300}
        value={texto} placeholder={p.placeholder || c.placeholder} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}
