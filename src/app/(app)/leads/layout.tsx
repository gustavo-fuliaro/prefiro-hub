import { SeletorPerfil } from "@/components/seletor-perfil";
import { contextoLeads } from "@/lib/dados-leads";
import { AbasLeads } from "./abas";

export const dynamic = "force-dynamic";

export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contextoLeads();
  if (!ctx) return null;
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Leads</h1>
        <p className="mt-1 text-muted">
          Prospecção pelo Instagram: cada lead tem um responsável e um prazo por etapa. Parado além do prazo, volta para a Base Geral.
        </p>
      </header>
      <SeletorPerfil perfis={ctx.perfis} atual={ctx.perfilAtual} />
      <AbasLeads admin={ctx.perm.admin} />
      {children}
    </div>
  );
}
