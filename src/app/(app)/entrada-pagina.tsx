"use client";

import { usePathname } from "next/navigation";

// Recria o contêiner a cada troca de rota para a entrada suave do conteúdo (ver .entrada-pagina).
export function EntradaPagina({ children }: { children: React.ReactNode }) {
  return (
    <div key={usePathname()} className="entrada-pagina">
      {children}
    </div>
  );
}
