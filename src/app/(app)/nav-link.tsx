"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeCadeado } from "@/components/icones";

// Item do trilho lateral. O ativo vira um balão laranja (a ponta no canto inferior esquerdo).
// Áreas em breve aparecem esmaecidas, com cadeado: abrem só a tela explicativa.
export function NavLink({ href, emBreve, children }: { href: string; emBreve?: boolean; children: React.ReactNode }) {
  const ativo = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      title={emBreve ? "Em breve" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-balao-sm px-3 py-2 text-sm transition-colors duration-150 ${
        ativo
          ? "bg-accent font-semibold text-accent-ink"
          : emBreve
            ? "text-rail-ink/55 hover:bg-rail-hover hover:text-rail-ink/80"
            : "text-rail-ink/85 hover:bg-rail-hover hover:text-rail-ink"
      }`}
    >
      {children}
      {emBreve && (
        <>
          <IconeCadeado className="ml-auto size-3.5 shrink-0" />
          <span className="sr-only">(em breve)</span>
        </>
      )}
    </Link>
  );
}
