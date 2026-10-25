import { Logotipo } from "@/components/marca";
import { estudioLiberado } from "@/lib/config";
import { membroAtual } from "@/lib/membro";
import { NAV_ITEMS } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { sair } from "./actions";
import { EntradaPagina } from "./entrada-pagina";
import { NavLink } from "./nav-link";

// A AGPL pede que quem usa o app pela internet consiga chegar ao código. Quem fizer um fork deve trocar este endereço.
const CODIGO_FONTE = process.env.NEXT_PUBLIC_CODIGO_FONTE_URL || "https://github.com/gustavo-fuliaro/prefiro-hub";

const PAPEL_LABEL = { admin: "Admin", estrategista: "Estrategista", criador: "Criador", leitura: "Leitura" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email, membro } = await membroAtual();
  const [{ count: naoLidos }, liberado] = membro
    ? await Promise.all([
        (await createClient()).from("alertas").select("id", { count: "exact", head: true }).eq("lido", false),
        estudioLiberado(),
      ])
    : [{ count: 0 }, false];

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] md:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="z-10 flex min-w-0 flex-col gap-9 bg-rail px-3 pt-10 pb-3 text-rail-ink md:sticky md:top-0 md:h-dvh md:gap-12 md:overflow-y-auto md:px-4 md:pt-12 md:pb-5 print:hidden">
        {/* Respiro do logotipo: o tamanho do balão (~36% da largura) em volta, como pede o manual. */}
        <div className="px-6 md:px-8">
          <Logotipo negativo largura={140} className="h-auto w-[96px] md:w-[136px]" />
        </div>

        <nav aria-label="Menu principal" className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          {NAV_ITEMS.map((item) =>
            item.fase ? (
              <span key={item.href} className="shrink-0 px-3 py-2 text-sm text-rail-muted" title={`Chega na fase ${item.fase}`}>
                {item.label} · Fase {item.fase}
              </span>
            ) : (
              <NavLink key={item.href} href={item.href}>
                <span className="flex items-center justify-between gap-3 whitespace-nowrap">
                  {item.label}
                  {item.href === "/alertas" && !!naoLidos && (
                    <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] leading-5 font-bold text-white tabular-nums" aria-label={`${naoLidos} não lidos`}>
                      {naoLidos > 99 ? "99+" : naoLidos}
                    </span>
                  )}
                  {item.href === "/estudio" && !liberado && (
                    <svg role="img" aria-label="Bloqueado" viewBox="0 0 24 24" className="size-4 opacity-70" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  )}
                </span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="mt-auto hidden gap-3 border-t border-white/10 pt-4 text-sm md:grid">
          <div className="flex items-center gap-3 px-2">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-balao-sm bg-accent font-display text-sm font-bold text-accent-ink">
              {(membro?.nome ?? email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{membro?.nome ?? email}</div>
              <div className="text-xs text-rail-muted">{membro ? PAPEL_LABEL[membro.papel] : "Sem acesso liberado"}</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-2">
            <form action={sair}>
              <button type="submit" className="text-rail-muted hover:text-rail-ink">
                Sair
              </button>
            </form>
            <a href={CODIGO_FONTE} target="_blank" rel="noopener noreferrer" className="text-xs text-rail-muted hover:text-rail-ink hover:underline">
              Código-fonte (AGPL-3.0)
            </a>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-10 lg:px-12">
        {membro ? (
          <EntradaPagina>{children}</EntradaPagina>
        ) : (
          <div className="max-w-xl rounded-balao border border-line bg-surface p-6 shadow-card">
            <h1 className="font-display text-2xl font-bold">Acesso ainda não liberado</h1>
            <p className="mt-2 text-muted">
              Sua conta ({email}) existe, mas ainda não foi adicionada à equipe do Hub. Peça a um admin para incluir você.
            </p>
          </div>
        )}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted md:hidden print:hidden">
          <span>{membro?.nome ?? email}</span>
          <span className="flex gap-4">
            <form action={sair}>
              <button type="submit" className="hover:text-ink">Sair</button>
            </form>
            <a href={CODIGO_FONTE} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
              Código-fonte (AGPL-3.0)
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
