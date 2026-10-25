import { estudioLiberado } from "@/lib/config";
import { membroAtual } from "@/lib/membro";
import { NAV_ITEMS } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { sair } from "./actions";
import { NavLink } from "./nav-link";

// A AGPL pede que quem usa o app pela internet consiga chegar ao código. Quem fizer um fork deve trocar este endereço.
const CODIGO_FONTE = process.env.NEXT_PUBLIC_CODIGO_FONTE_URL || "https://github.com/gustavo-fuliaro/prefiro-hub";

const PAPEL_LABEL ={ admin: "Admin", estrategista: "Estrategista", criador: "Criador", leitura: "Leitura" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email, membro } = await membroAtual();
  const [{ count: naoLidos }, liberado] = membro
    ? await Promise.all([
        (await createClient()).from("alertas").select("id", { count: "exact", head: true }).eq("lido", false),
        estudioLiberado(),
      ])
    : [{ count: 0 }, false];

  return (
    <div className="grid min-h-dvh md:grid-cols-[232px_minmax(0,1fr)] print:block">
      <aside className="flex flex-col gap-6 border-b border-line bg-surface px-4 py-5 md:border-r md:border-b-0 print:hidden">
        <div className="font-display text-xl font-extrabold tracking-tight">Prefiro Hub</div>
        <nav aria-label="Menu principal" className="flex flex-wrap gap-1 md:flex-col">
          {NAV_ITEMS.map((item) =>
            item.fase ? (
              <span
                key={item.href}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-muted opacity-70"
                title={`Chega na fase ${item.fase}`}
              >
                {item.label}
                <span className="text-[11px] uppercase tracking-wide">Fase {item.fase}</span>
              </span>
            ) : (
              <NavLink key={item.href} href={item.href}>
                <span className="flex items-center justify-between gap-2">
                  {item.label}
                  {item.href === "/alertas" && !!naoLidos && (
                    <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold tabular-nums text-surface" aria-label={`${naoLidos} não lidos`}>
                      {naoLidos > 99 ? "99+" : naoLidos}
                    </span>
                  )}
                  {item.href === "/estudio" && !liberado && (
                    <svg role="img" aria-label="Bloqueado" viewBox="0 0 24 24" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                </span>
              </NavLink>
            ),
          )}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-line pt-4 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{membro?.nome ?? email}</div>
            <div className="text-muted">{membro ? PAPEL_LABEL[membro.papel] : "Sem acesso liberado"}</div>
          </div>
          <form action={sair}>
            <button type="submit" className="text-muted underline-offset-4 hover:underline">
              Sair
            </button>
          </form>
          <a href={CODIGO_FONTE} target="_blank" rel="noopener noreferrer" className="text-xs text-muted underline-offset-4 hover:underline">
            Código-fonte (AGPL-3.0)
          </a>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 md:px-10">
        {membro ? (
          children
        ) : (
          <div className="max-w-xl rounded-xl border border-line bg-surface p-6">
            <h1 className="font-display text-2xl font-extrabold">Acesso ainda não liberado</h1>
            <p className="mt-2 text-muted">
              Sua conta ({email}) existe, mas ainda não foi adicionada à equipe do Hub. Peça a um admin para incluir você.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
