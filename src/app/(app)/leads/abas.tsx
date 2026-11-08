"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Abas da área de Leads. Configurações só aparece para admins.
export function AbasLeads({ admin }: { admin: boolean }) {
  const caminho = usePathname();
  const abas = [
    { href: "/leads", rotulo: "Social Selling" },
    { href: "/leads/follow-up", rotulo: "Follow-up" },
    { href: "/leads/base", rotulo: "Base Geral" },
    ...(admin ? [{ href: "/leads/configuracoes", rotulo: "Configurações" }] : []),
  ];
  return (
    <nav aria-label="Seções de leads" className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
      <ul className="flex w-max gap-1 border-b border-line">
        {abas.map((a) => {
          const ativa = caminho === a.href;
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={`-mb-px block border-b-2 px-3 py-2 text-sm font-medium ${ativa ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
              >
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
