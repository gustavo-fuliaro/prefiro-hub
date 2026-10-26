import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { membroAtual, podeEditarCadastro } from "@/lib/membro";
import { formatarNumero, formatarPct, formatarVariacao } from "@/lib/metricas";
import { GRUPOS, type Grupo } from "@/lib/perfis";
import { createClient } from "@/lib/supabase/server";
import { ColetarBotao } from "./coletar-botao";
import { ExcluirPerfil } from "./excluir-perfil";
import { NovoPerfilForm } from "./novo-perfil-form";

export const metadata: Metadata = { title: "Perfis" };

type Resumo = {
  id: number;
  handle: string;
  nome: string | null;
  grupo: Grupo;
  ativo: boolean;
  foto_path: string | null;
  ultima_coleta_em: string | null;
  ultimo_erro: string | null;
  seguidores: number | null;
  delta_7d: number | null;
  delta_30d: number | null;
  engajamento_pct: number | null;
};

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

function Delta({ v }: { v: number | null }) {
  const cor = v === null || v === 0 ? "text-muted" : v > 0 ? "text-ok" : "text-danger";
  return <span className={`tabular-nums ${cor}`}>{formatarVariacao(v)}</span>;
}

export default async function PerfisPage() {
  const { membro } = await membroAtual();
  const pode = podeEditarCadastro(membro?.papel);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfis_resumo")
    .select("id, handle, nome, grupo, ativo, foto_path, ultima_coleta_em, ultimo_erro, seguidores, delta_7d, delta_30d, engajamento_pct")
    .order("seguidores", { ascending: false, nullsFirst: false })
    .returns<Resumo[]>();

  const perfis = data ?? [];

  return (
    <div className="grid max-w-6xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-bold tracking-tight">Perfis monitorados</h1>
          <p className="mt-1 text-muted">Números atualizados todo dia às 06:00. Clique em um perfil para ver o cockpit.</p>
        </div>
        {pode && perfis.length > 0 && <ColetarBotao />}
      </header>

      {pode && <NovoPerfilForm />}

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-danger">
          Não foi possível carregar os perfis. Tente recarregar a página.
        </p>
      ) : perfis.length === 0 ? (
        <div className="rounded-balao border border-dashed border-line px-6 py-10 text-center">
          <p className="font-medium">Nenhum perfil cadastrado ainda.</p>
          <p className="mt-1 text-sm text-muted">Comece pelos perfis da Prefiro e depois adicione os concorrentes.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-balao border border-line bg-surface shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">Perfil</th>
                <th className="px-4 py-3 font-semibold">Grupo</th>
                <th className="px-4 py-3 text-right font-semibold">Seguidores</th>
                <th className="px-4 py-3 text-right font-semibold">7 dias</th>
                <th className="px-4 py-3 text-right font-semibold">30 dias</th>
                <th className="px-4 py-3 text-right font-semibold">Engajamento</th>
                <th className="px-4 py-3 font-semibold">Situação</th>
                {pode && <th className="px-4 py-3"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 hover:bg-bg">
                  <td className="px-4 py-3">
                    <Link href={`/perfis/${p.handle}`} className="flex items-center gap-3">
                      <Avatar caminho={p.foto_path} handle={p.handle} />
                      <span className="min-w-0">
                        <span className="block font-medium text-accent-strong">@{p.handle}</span>
                        {p.nome && <span className="block truncate text-muted">{p.nome}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{GRUPOS[p.grupo]}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatarNumero(p.seguidores)}</td>
                  <td className="px-4 py-3 text-right"><Delta v={p.delta_7d} /></td>
                  <td className="px-4 py-3 text-right"><Delta v={p.delta_30d} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatarPct(p.engajamento_pct, 2)}</td>
                  <td className="px-4 py-3">
                    {!p.ativo ? (
                      <span className="text-muted">Pausado</span>
                    ) : p.ultimo_erro ? (
                      <span className="text-danger" title={p.ultimo_erro}>Erro na coleta</span>
                    ) : p.ultima_coleta_em ? (
                      <span className="text-muted">{dataHora.format(new Date(p.ultima_coleta_em))}</span>
                    ) : (
                      <span className="text-warn">Aguardando 1ª coleta</span>
                    )}
                  </td>
                  {pode && (
                    <td className="px-2 py-3 text-right">
                      <ExcluirPerfil id={p.id} handle={p.handle} compacto />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
