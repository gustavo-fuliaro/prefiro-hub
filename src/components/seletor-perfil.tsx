"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { COOKIE_PERFIL, TODOS, type PerfilProprio } from "@/lib/perfis-proprios";

// Troca o perfil próprio em foco. A escolha vale para todas as abas de produção.
export function SeletorPerfil({ perfis, atual }: { perfis: PerfilProprio[]; atual: number | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mostrado, setMostrado] = useOptimistic(atual);

  if (perfis.length === 0) {
    return (
      <p className="rounded-balao-sm border border-dashed border-line px-4 py-3 text-sm text-muted">
        Nenhum perfil próprio cadastrado. Cadastre em{" "}
        <Link href="/perfis" className="font-medium text-accent-strong hover:underline">Perfis</Link> com o grupo &quot;Próprio&quot; para separar a produção por perfil.
      </p>
    );
  }

  function escolher(id: number | null) {
    if (id === mostrado) return;
    document.cookie = `${COOKIE_PERFIL}=${id ?? TODOS}; path=/; max-age=31536000; samesite=lax`;
    // Um relatório aberto pertence ao perfil anterior: sai dele e mostra o mais recente do novo perfil.
    const url = new URL(window.location.href);
    const tinha = url.searchParams.has("relatorio") || url.searchParams.has("comparar");
    url.searchParams.delete("relatorio");
    url.searchParams.delete("comparar");
    iniciar(() => {
      setMostrado(id);
      if (tinha) router.replace(url.pathname + url.search);
      else router.refresh();
    });
  }

  const chip = (ativo: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pr-3.5 text-sm font-medium transition-colors ${
      ativo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface hover:border-accent"
    }`;

  return (
    <nav aria-label="Perfil em foco" aria-busy={pendente} className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
      <ul className="flex w-max items-center gap-1.5">
        <li>
          <button type="button" aria-pressed={mostrado === null} onClick={() => escolher(null)} className={`${chip(mostrado === null)} pl-1`}>
            <span aria-hidden className="grid size-8 place-items-center rounded-full bg-rail text-[11px] font-bold text-rail-ink">{perfis.length}</span>
            Todos os perfis
          </button>
        </li>
        {perfis.map((p) => (
          <li key={p.id}>
            <button type="button" aria-pressed={mostrado === p.id} onClick={() => escolher(p.id)} className={`${chip(mostrado === p.id)} pl-1`} title={p.nome ?? undefined}>
              <Avatar caminho={p.foto_path} handle={p.handle} tamanho={32} />
              @{p.handle}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
