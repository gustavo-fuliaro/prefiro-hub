import Link from "next/link";
import { redirect } from "next/navigation";
import { Logotipo } from "@/components/marca";
import { membroAtual } from "@/lib/membro";
import { itensDoMenu } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { sair } from "./actions";
import { EntradaPagina } from "./entrada-pagina";
import { NavLink } from "./nav-link";
import { Notificacoes, type Notificacao } from "./notificacoes";

// A AGPL pede que quem usa o app pela internet consiga chegar ao código. Quem fizer um fork deve trocar este endereço.
const CODIGO_FONTE = process.env.NEXT_PUBLIC_CODIGO_FONTE_URL || "https://github.com/gustavo-fuliaro/prefiro-hub";

const PAPEL_LABEL = { admin: "Admin", estrategista: "Estrategista", criador: "Criador", leitura: "Leitura" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { email, membro } = await membroAtual();
  // Senha provisória: a pessoa define a própria senha antes de usar o Hub.
  if (membro?.ativo && membro.deve_trocar_senha) redirect("/trocar-senha");

  const liberado = !!membro?.ativo;
  const supabase = await createClient();
  const [{ data: alertas }, { count: naoLidas }] = liberado
    ? await Promise.all([
        supabase
          .from("alertas")
          .select("id, tipo, mensagem, severidade, link, lido, criado_em")
          .order("criado_em", { ascending: false })
          .limit(40)
          .returns<Notificacao[]>(),
        supabase.from("alertas").select("id", { count: "exact", head: true }).eq("lido", false),
      ])
    : [{ data: [] as Notificacao[] }, { count: 0 }];

  const sino = (variante: "claro" | "trilho") => <Notificacoes itens={alertas ?? []} naoLidas={naoLidas ?? 0} variante={variante} />;
  const menu = itensDoMenu(!!membro?.super_admin && liberado);

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] md:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="z-10 flex min-w-0 flex-col gap-9 bg-rail px-3 pt-10 pb-3 text-rail-ink md:sticky md:top-0 md:h-dvh md:gap-12 md:overflow-y-auto md:px-4 md:pt-12 md:pb-5 print:hidden">
        {/* Respiro do logotipo: o tamanho do balão (~36% da largura) em volta, como pede o manual. */}
        <div className="flex items-center justify-between gap-4 px-6 md:px-8">
          <Logotipo negativo largura={140} className="h-auto w-[96px] md:w-[136px]" />
          {liberado && <div className="md:hidden">{sino("trilho")}</div>}
        </div>

        {liberado && (
          <nav aria-label="Menu principal" className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
            {menu.map((item) => (
              <NavLink key={item.href} href={item.href}>
                <span className="whitespace-nowrap">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

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
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2">
            <form action={sair}>
              <button type="submit" className="text-rail-muted hover:text-rail-ink">
                Sair
              </button>
            </form>
            {liberado && (
              <Link href="/trocar-senha" className="text-xs text-rail-muted hover:text-rail-ink hover:underline">
                Trocar senha
              </Link>
            )}
            <a href={CODIGO_FONTE} target="_blank" rel="noopener noreferrer" className="w-full text-xs text-rail-muted hover:text-rail-ink hover:underline">
              Código-fonte (AGPL-3.0)
            </a>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 md:px-10 md:pt-6 md:pb-10 lg:px-12">
        {liberado && <div className="mb-4 hidden justify-end md:flex print:hidden">{sino("claro")}</div>}
        {!membro ? (
          <div className="max-w-xl rounded-balao border border-line bg-surface p-6 shadow-card">
            <h1 className="font-display text-2xl font-bold">Acesso ainda não liberado</h1>
            <p className="mt-2 text-muted">
              Sua conta ({email}) existe, mas ainda não foi liberada no Hub. Fale com o administrador.
            </p>
          </div>
        ) : !membro.ativo ? (
          <div className="max-w-xl rounded-balao border border-line bg-surface p-6 shadow-card">
            <h1 className="font-display text-2xl font-bold">Acesso bloqueado</h1>
            <p className="mt-2 text-muted">
              O acesso desta conta ({email}) está bloqueado pelo administrador do Hub. Fale com ele para liberar.
            </p>
          </div>
        ) : (
          <EntradaPagina>{children}</EntradaPagina>
        )}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted md:hidden print:hidden">
          <span>{membro?.nome ?? email}</span>
          <span className="flex flex-wrap gap-4">
            <form action={sair}>
              <button type="submit" className="hover:text-ink">Sair</button>
            </form>
            {liberado && <Link href="/trocar-senha" className="hover:text-ink hover:underline">Trocar senha</Link>}
            <a href={CODIGO_FONTE} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">
              Código-fonte (AGPL-3.0)
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
