"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Item do trilho lateral. O ativo vira um balão laranja (a ponta no canto inferior esquerdo).
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const ativo = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`block shrink-0 rounded-balao-sm px-3 py-2 text-sm transition-colors duration-150 ${
        ativo ? "bg-accent font-semibold text-accent-ink" : "text-rail-ink/85 hover:bg-rail-hover hover:text-rail-ink"
      }`}
    >
      {children}
    </Link>
  );
}
