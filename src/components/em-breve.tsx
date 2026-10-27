import Link from "next/link";
import { IconeCadeado } from "@/components/icones";
import { SeletorPerfil } from "@/components/seletor-perfil";
import { escolhaDePerfil } from "@/lib/dados-perfis";
import { rotuloEscopo } from "@/lib/perfis-proprios";

// Tela de área bloqueada: explica o que vem aí, sem nenhuma função ativa.
// O seletor de perfil já aparece aqui: quando a área abrir, ela mostra o conteúdo do perfil em foco.
export async function AreaEmBreve({ titulo, resumo, itens }: { titulo: string; resumo: string; itens: string[] }) {
  const { perfis, perfilAtual } = await escolhaDePerfil();
  return (
    <div className="grid max-w-3xl gap-6">
      <header className="grid gap-3">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
          <IconeCadeado className="size-3.5" />
          Em breve
        </span>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">{titulo}</h1>
        <p className="text-muted">{resumo}</p>
      </header>
      <section aria-label="Perfil em foco" className="grid gap-2">
        <SeletorPerfil perfis={perfis} atual={perfilAtual} />
        {perfis.length > 0 && (
          <p className="text-sm text-muted">
            Quando esta área abrir, ela vai mostrar o conteúdo de {rotuloEscopo(perfis, perfilAtual)}, com visão individual por perfil ou de todos juntos.
          </p>
        )}
      </section>
      <section className="grid gap-3 rounded-balao border border-line bg-surface p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">O que esta área vai trazer</h2>
        <ul className="grid gap-2 text-sm">
          {itens.map((i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              {i}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Enquanto isso, a produção de conteúdo segue no <Link href="/planejador" className="font-medium text-accent-strong underline-offset-2 hover:underline">Planejador</Link>.
        </p>
      </section>
    </div>
  );
}
