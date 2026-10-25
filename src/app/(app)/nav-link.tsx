"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const ativo = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm font-medium ${
        ativo ? "bg-accent-soft text-accent" : "text-ink hover:bg-bg"
      }`}
    >
      {children}
    </Link>
  );
}
