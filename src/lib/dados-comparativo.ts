import type { Snapshot } from "@/lib/comparativo";
import type { Grupo } from "@/lib/perfis";
import { createClient } from "@/lib/supabase/server";

export type PerfilComparado = { id: number; handle: string; nome: string | null; grupo: Grupo; foto_path: string | null };

export function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function diasAtras(hoje: string, n: number) {
  return new Date(Date.parse(`${hoje}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

export async function carregarComparativo(opts: { grupos: Grupo[]; desde: string }) {
  const supabase = await createClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("id, handle, nome, grupo, foto_path")
    .eq("ativo", true)
    .in("grupo", opts.grupos)
    .order("handle")
    .returns<PerfilComparado[]>();
  const lista = perfis ?? [];
  const ids = lista.map((p) => p.id);
  if (!ids.length) return { perfis: lista, snapshots: [] as Snapshot[], interacoes: new Map<number, number | null>() };

  const [{ data: snaps }, { data: posts }] = await Promise.all([
    supabase.from("snapshots_diarios").select("perfil_id, dia, seguidores, total_posts").in("perfil_id", ids).gte("dia", opts.desde).order("dia").returns<Snapshot[]>(),
    supabase.from("posts").select("id, perfil_id, publicado_em").in("perfil_id", ids).order("publicado_em", { ascending: false }).limit(ids.length * 40)
      .returns<{ id: string; perfil_id: number; publicado_em: string | null }[]>(),
  ]);

  // 12 posts mais recentes de cada perfil e a última leitura de cada um.
  const recentes = new Map<number, string[]>();
  for (const p of posts ?? []) {
    const l = recentes.get(p.perfil_id) ?? [];
    if (l.length < 12) recentes.set(p.perfil_id, [...l, p.id]);
  }
  const todosIds = [...recentes.values()].flat();
  const { data: metricas } = todosIds.length
    ? await supabase.from("post_metricas").select("post_id, dia, likes, comentarios").in("post_id", todosIds).order("dia")
        .returns<{ post_id: string; dia: string; likes: number | null; comentarios: number | null }[]>()
    : { data: [] };
  const ultima = new Map<string, number>();
  for (const m of metricas ?? []) ultima.set(m.post_id, (m.likes ?? 0) + (m.comentarios ?? 0));

  const interacoes = new Map<number, number | null>();
  for (const [perfilId, postIds] of recentes) {
    const vals = postIds.map((id) => ultima.get(id)).filter((v): v is number => v !== undefined);
    interacoes.set(perfilId, vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  }

  return { perfis: lista, snapshots: snaps ?? [], interacoes };
}
