import Link from "next/link";
import type { PerfilCurto } from "@/lib/dados-planejador";

// Abas com os perfis. `extra` mantém outros parâmetros da URL (ex.: mês do calendário).
export function SeletorPerfil({
  perfis,
  atual,
  base,
  extra = {},
  incluirTodos = false,
}: {
  perfis: PerfilCurto[];
  atual: string | null;
  base: string;
  extra?: Record<string, string>;
  incluirTodos?: boolean;
}) {
  const href = (perfil: string | null) => {
    const qs = new URLSearchParams(extra);
    if (perfil) qs.set("perfil", perfil);
    const s = qs.toString();
    return s ? `${base}?${s}` : base;
  };
  const opcoes: { valor: string | null; rotulo: string }[] = [
    ...(incluirTodos ? [{ valor: null, rotulo: "Todos" }] : []),
    ...perfis.map((p) => ({ valor: p.handle, rotulo: `@${p.handle}` })),
  ];
  return (
    <nav aria-label="Perfil" className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1 text-sm">
      {opcoes.map((o) => {
        const ativo = o.valor === atual;
        return (
          <Link
            key={o.valor ?? "todos"}
            href={href(o.valor)}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${ativo ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-ink"}`}
          >
            {o.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
