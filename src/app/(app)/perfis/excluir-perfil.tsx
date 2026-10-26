"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialogo } from "@/components/dialogo";
import { IconeLixeira } from "@/components/icones";
import { excluirPerfil } from "./actions";

// Botão "Excluir perfil" com confirmação. Na página do perfil, volta para a lista depois de excluir.
export function ExcluirPerfil({ id, handle, voltarParaLista = false, compacto = false }: { id: number; handle: string; voltarParaLista?: boolean; compacto?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await excluirPerfil(id);
      if (r.erro) return setErro(r.erro);
      setAberto(false);
      if (voltarParaLista) router.push("/perfis");
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={compacto ? `Excluir @${handle}` : undefined}
        title={compacto ? `Excluir @${handle}` : undefined}
        className={
          compacto
            ? "grid size-8 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
            : "inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-danger hover:border-danger hover:bg-danger-soft"
        }
      >
        <IconeLixeira />
        {!compacto && "Excluir perfil"}
      </button>
      {aberto && (
        <Dialogo
          titulo={`Excluir @${handle}?`}
          largura="sm"
          aoFechar={() => setAberto(false)}
          descricao="O perfil sai do monitoramento junto com o histórico de números, posts, metas, ideias e alertas dele. Os comparativos e relatórios seguintes deixam de contar este perfil. Não dá para desfazer."
        >
          {erro && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAberto(false)} className="rounded-md border border-line px-4 py-2 text-sm">Cancelar</button>
            <button type="button" disabled={pendente} onClick={confirmar} className="rounded-md bg-danger px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {pendente ? "Excluindo…" : "Excluir perfil"}
            </button>
          </div>
        </Dialogo>
      )}
    </>
  );
}
