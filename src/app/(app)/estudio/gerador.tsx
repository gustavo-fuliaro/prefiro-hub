"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TIPOS_GERACAO, type TipoGeracao } from "@/lib/estudio";
import { createClient } from "@/lib/supabase/client";
import { iniciarGeracao } from "./actions";

const campo = "rounded-md border border-line bg-bg px-3 py-2 font-normal disabled:opacity-70";
const ETAPAS = ["Lendo o posicionamento e os posts…", "Escrevendo…", "Revisando o formato…", "Quase pronto…"];

export function Gerador({
  perfil,
  ideias,
  tipoInicial,
  ideiaInicial,
}: {
  perfil: { id: number; handle: string };
  ideias: { id: number; titulo: string }[];
  tipoInicial: TipoGeracao;
  ideiaInicial: number | null;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoGeracao>(tipoInicial);
  const [jobId, setJobId] = useState<string | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const inicio = useRef(0);

  // Acompanha o job a cada 3 s, até 4 minutos.
  useEffect(() => {
    if (!jobId) return;
    const supabase = createClient();
    inicio.current = Date.now();
    const t = setInterval(async () => {
      setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
      const { data } = await supabase.from("jobs").select("status, erro, resultado").eq("id", jobId).maybeSingle<{
        status: string;
        erro: string | null;
        resultado: { material_id?: number } | null;
      }>();
      if (data?.status === "concluido" && data.resultado?.material_id) {
        clearInterval(t);
        setJobId(null);
        router.push(`/estudio?perfil=${perfil.handle}&material=${data.resultado.material_id}`);
        router.refresh();
      } else if (data?.status === "erro") {
        clearInterval(t);
        setJobId(null);
        setErro(data.erro ?? "A geração falhou.");
      } else if (Date.now() - inicio.current > 240_000) {
        clearInterval(t);
        setJobId(null);
        setErro("A geração está demorando mais que o normal. Confira o histórico em alguns minutos.");
      }
    }, 3000);
    return () => clearInterval(t);
  }, [jobId, perfil.handle, router]);

  async function gerar(fd: FormData) {
    setErro(null);
    setEtapa(0);
    const r = await iniciarGeracao({
      tipo,
      perfil_id: perfil.id,
      contexto: String(fd.get("contexto") ?? ""),
      quantidade: Number(fd.get("quantidade")) || undefined,
      ideia_id: Number(fd.get("ideia_id")) || undefined,
    });
    if (r.erro) setErro(r.erro);
    else if (r.jobId) setJobId(r.jobId);
  }

  const gerando = !!jobId;

  return (
    <form action={gerar} className="grid gap-4 rounded-xl border border-line bg-surface p-5">
      <fieldset disabled={gerando} className="grid gap-4">
        <legend className="sr-only">O que gerar</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.entries(TIPOS_GERACAO) as [TipoGeracao, { rotulo: string; descricao: string }][]).map(([v, t]) => (
            <label
              key={v}
              className={`cursor-pointer rounded-lg border p-3 ${tipo === v ? "border-accent bg-accent-soft" : "border-line hover:border-accent"}`}
            >
              <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} className="sr-only" />
              <span className="block font-semibold">{t.rotulo}</span>
              <span className="block text-xs text-muted">{t.descricao}</span>
            </label>
          ))}
        </div>

        {tipo === "ideias" && (
          <label className="grid max-w-40 gap-1 text-sm font-medium">
            Quantas ideias
            <input id="quantidade" name="quantidade" type="number" min={3} max={15} defaultValue={8} className={campo} />
          </label>
        )}

        {tipo === "roteiro" && (
          <label className="grid gap-1 text-sm font-medium">
            Ideia do planejador
            {ideias.length ? (
              <select id="ideia_id" name="ideia_id" required defaultValue={ideiaInicial ?? ideias[0].id} className={campo}>
                {ideias.map((i) => (
                  <option key={i.id} value={i.id}>{i.titulo}</option>
                ))}
              </select>
            ) : (
              <span className="text-muted">Nenhuma ideia no planejador deste perfil ainda.</span>
            )}
          </label>
        )}

        <label className="grid gap-1 text-sm font-medium">
          Direcionamento (opcional)
          <textarea
            id="contexto"
            name="contexto"
            rows={3}
            maxLength={3000}
            className={campo}
            placeholder={
              tipo === "ideias"
                ? "Ex.: campanha de imóveis em novembro, foco em quem paga aluguel"
                : tipo === "roteiro"
                  ? "Ex.: gravar no escritório, tom mais leve, citar o simulador"
                  : "Ex.: comparar Reels e carrosséis"
            }
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={gerando || (tipo === "roteiro" && !ideias.length)}
          className="rounded-md bg-accent px-5 py-2 font-semibold text-accent-ink disabled:opacity-60"
        >
          {gerando ? "Gerando…" : `Gerar para @${perfil.handle}`}
        </button>
        <span aria-live="polite" className="text-sm">
          {gerando && <span className="text-muted">{ETAPAS[etapa]} Costuma levar de 20 a 60 segundos.</span>}
          {erro && <span className="text-danger">{erro}</span>}
        </span>
      </div>
    </form>
  );
}
