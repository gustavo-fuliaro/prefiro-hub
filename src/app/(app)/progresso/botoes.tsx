"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COOKIE_PERFIL, TODOS, type PerfilProprio } from "@/lib/perfis-proprios";
import { gerarRelatorioPeriodo, type EscopoGerar } from "./actions";

// Relatório personalizado: escolhe o intervalo e de quais perfis, e gera na hora, sem mexer nos semanais.
export function GerarPeriodo({ hoje, perfis, atual }: { hoje: string; perfis: PerfilProprio[]; atual: number | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = "h-9 rounded-md border border-line bg-surface px-2.5 text-sm";
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const de = String(fd.get("de") ?? "");
        const ate = String(fd.get("ate") ?? "");
        const v = String(fd.get("escopo") ?? "grupo");
        const escopo: EscopoGerar = v === "grupo" || v === "cada" ? v : Number(v);
        iniciar(async () => {
          setErro(null);
          setAviso(null);
          const r = await gerarRelatorioPeriodo(de, ate, escopo);
          if (r.erro || !r.gerados?.length) return setErro(r.erro ?? "Não foi possível gerar o relatório.");
          if (escopo === "cada") {
            // Um por perfil: continua no perfil em foco e abre o relatório dele (na visão em grupo, só lista).
            setAviso(`${r.gerados.length} relatórios gerados, um por perfil. Escolha o perfil acima para ver cada um.`);
            const doFoco = r.gerados.find((g) => g.perfil === atual);
            router.push(doFoco ? `/progresso?relatorio=${doFoco.id}` : "/progresso");
          } else {
            // Grupo ou um perfil: abre o relatório já com o perfil dele em foco.
            document.cookie = `${COOKIE_PERFIL}=${escopo === "grupo" ? TODOS : escopo}; path=/; max-age=31536000; samesite=lax`;
            router.push(`/progresso?relatorio=${r.gerados[0].id}`);
          }
          router.refresh();
        });
      }}
    >
      <label className="grid gap-1 text-xs font-medium text-muted">
        De
        <input name="de" type="date" required max={hoje} className={campo} />
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted">
        Até
        <input name="ate" type="date" required max={hoje} defaultValue={hoje} className={campo} />
      </label>
      {perfis.length > 0 && (
        <label className="grid gap-1 text-xs font-medium text-muted">
          Perfis
          <select name="escopo" defaultValue={atual === null ? "grupo" : String(atual)} className={campo}>
            <option value="grupo">Todos juntos (um relatório)</option>
            {perfis.length > 1 && <option value="cada">Um relatório para cada perfil</option>}
            {perfis.map((p) => (
              <option key={p.id} value={p.id}>Só @{p.handle}</option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" disabled={pendente} className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-accent-ink disabled:opacity-60">
        {pendente ? "Gerando…" : "Gerar relatório do período"}
      </button>
      {erro && <span role="alert" className="w-full text-sm text-danger">{erro}</span>}
      {aviso && <span role="status" className="w-full text-sm text-ok">{aviso}</span>}
    </form>
  );
}

export function Imprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="h-9 rounded-md border border-line px-3 text-sm hover:border-accent">
      Imprimir ou salvar PDF
    </button>
  );
}
