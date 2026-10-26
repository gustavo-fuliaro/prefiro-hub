// Leitura e gravação de tarefas pelo navegador. Toda regra de acesso fica no banco (RLS por ambiente);
// aqui só traduzimos erros para frases que a equipe entende.
import { createClient } from "@/lib/supabase/client";
import { CAMPOS_TAREFA, type Evento, type Tarefa } from "@/lib/tarefas";

export type Comentario = { id: number; tarefa_id: number; autor: string | null; autor_nome: string; texto: string; criado_em: string };
type Resultado<T> = { ok: T; erro?: undefined } | { ok?: undefined; erro: string };

let cliente: ReturnType<typeof createClient> | null = null;
export function supabaseNavegador() {
  cliente ??= createClient();
  return cliente;
}

type Canal = ReturnType<ReturnType<typeof createClient>["channel"]>;

// Canal de tempo real já autenticado. Sem passar o token antes, o canal entra como anônimo
// (a sessão ainda não carregou) e o banco, pelo RLS, não manda nenhuma mudança.
// Devolve a função de limpeza para o useEffect.
export function aoVivo(nome: string, montar: (c: Canal) => Canal, aoMudarStatus?: (conectado: boolean) => void): () => void {
  const sb = supabaseNavegador();
  let canal: Canal | null = null;
  let ativo = true;
  (async () => {
    const { data } = await sb.auth.getSession();
    if (!ativo) return;
    if (data.session) await sb.realtime.setAuth(data.session.access_token);
    if (!ativo) return;
    // Nome único por montagem: no modo de desenvolvimento o React monta duas vezes, e reaproveitar
    // o mesmo nome faz a saída do primeiro canal derrubar o segundo.
    canal = montar(sb.channel(`${nome}-${crypto.randomUUID()}`));
    canal.subscribe((s) => aoMudarStatus?.(s === "SUBSCRIBED"));
  })();
  return () => {
    ativo = false;
    if (canal) sb.removeChannel(canal);
  };
}

export function traduzirErro(e: { code?: string; message?: string } | null): string {
  if (!e) return "Algo deu errado. Tente de novo.";
  if (e.code === "42501" || /row-level security|permission/i.test(e.message ?? "")) return "Seu papel não permite esta ação.";
  if (e.code === "23514") return "Algum campo está fora do formato aceito. Confira nome e links.";
  if (e.code === "23503") return "O responsável escolhido não faz parte deste ambiente.";
  if (e.code === "PGRST116") return "Esta tarefa não existe mais ou você não tem acesso a ela.";
  return "Não foi possível salvar. Confira a conexão e tente de novo.";
}

export async function criarTarefa(dados: Partial<Tarefa>): Promise<Resultado<Tarefa>> {
  const { data, error } = await supabaseNavegador().from("tarefas").insert(dados).select(CAMPOS_TAREFA).single<Tarefa>();
  return error || !data ? { erro: traduzirErro(error) } : { ok: data };
}

export async function atualizarTarefa(id: number, mudanca: Partial<Tarefa>): Promise<Resultado<Tarefa>> {
  const { data, error } = await supabaseNavegador().from("tarefas").update(mudanca).eq("id", id).select(CAMPOS_TAREFA).single<Tarefa>();
  return error || !data ? { erro: traduzirErro(error) } : { ok: data };
}

export async function lerTarefa(id: number): Promise<Resultado<Tarefa>> {
  const { data, error } = await supabaseNavegador().from("tarefas").select(CAMPOS_TAREFA).eq("id", id).single<Tarefa>();
  return error || !data ? { erro: traduzirErro(error) } : { ok: data };
}

export async function excluirTarefa(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("tarefas").delete().eq("id", id).select("id");
  if (error) return { erro: traduzirErro(error) };
  return data && data.length ? { ok: true } : { erro: "Seu papel não permite excluir tarefas." };
}

export async function lerComentarios(tarefaId: number): Promise<Resultado<Comentario[]>> {
  const { data, error } = await supabaseNavegador()
    .from("tarefa_comentarios")
    .select("id, tarefa_id, autor, autor_nome, texto, criado_em")
    .eq("tarefa_id", tarefaId)
    .order("criado_em", { ascending: true })
    .order("id", { ascending: true })
    .returns<Comentario[]>();
  return error ? { erro: traduzirErro(error) } : { ok: data ?? [] };
}

export async function comentar(tarefaId: number, texto: string): Promise<Resultado<Comentario>> {
  const { data, error } = await supabaseNavegador()
    .from("tarefa_comentarios")
    .insert({ tarefa_id: tarefaId, texto })
    .select("id, tarefa_id, autor, autor_nome, texto, criado_em")
    .single<Comentario>();
  return error || !data ? { erro: traduzirErro(error) } : { ok: data };
}

export async function apagarComentario(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("tarefa_comentarios").delete().eq("id", id).select("id");
  if (error) return { erro: traduzirErro(error) };
  return data && data.length ? { ok: true } : { erro: "Você só pode excluir os próprios comentários." };
}

export async function lerEventos(tarefaId: number): Promise<Resultado<Evento[]>> {
  const { data, error } = await supabaseNavegador()
    .from("tarefa_eventos")
    .select("id, tarefa_id, tipo, de, para, autor_nome, criado_em")
    .eq("tarefa_id", tarefaId)
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(100)
    .returns<Evento[]>();
  return error ? { erro: traduzirErro(error) } : { ok: data ?? [] };
}
