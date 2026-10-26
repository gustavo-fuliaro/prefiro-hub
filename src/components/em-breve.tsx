import Link from "next/link";
import { IconeCadeado } from "@/components/icones";

// Tela de área bloqueada: explica o que vem aí, sem nenhuma função ativa.
export function AreaEmBreve({ titulo, resumo, itens }: { titulo: string; resumo: string; itens: string[] }) {
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
