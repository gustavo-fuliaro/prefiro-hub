// Formulários pelo navegador (equipe logada). Publicar e tirar do ar passam pelas funções do banco, que validam.
import { CAMPOS_FORMULARIO, slugAleatorio, type Formulario } from "@/lib/formularios";
import { supabaseNavegador } from "@/lib/tarefas-api";

type Resultado<T> = { ok: T; erro?: undefined } | { ok?: undefined; erro: string };

export function traduzirErroForm(e: { code?: string; message?: string } | null): string {
  if (!e) return "Algo deu errado. Tente de novo.";
  const msg = e.message ?? "";
  if (/^(O funil|A etapa|O perfil|O responsável|Seu papel|Formulário)/.test(msg)) return msg;
  if (e.code === "23505") return "Este endereço já está em uso por outro formulário. Escolha outro.";
  if (e.code === "42501" || /row-level security|permission/i.test(msg)) return "Seu papel não permite esta ação.";
  if (e.code === "23514") return "Algum campo está fora do formato aceito. Confira o título e o endereço.";
  return "Não foi possível salvar. Confira a conexão e tente de novo.";
}

export async function criarFormulario(titulo: string, extra: Partial<Formulario> = {}): Promise<Resultado<Formulario>> {
  // Endereço aleatório; em caso raro de colisão, tenta de novo.
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabaseNavegador()
      .from("formularios").insert({ titulo, slug: slugAleatorio(), ...extra }).select(CAMPOS_FORMULARIO).single<Formulario>();
    if (!error && data) return { ok: data };
    if (error?.code !== "23505") return { erro: traduzirErroForm(error) };
  }
  return { erro: "Não foi possível gerar um endereço. Tente de novo." };
}

export async function salvarFormulario(id: number, mudanca: Partial<Formulario>): Promise<Resultado<Formulario>> {
  const { data, error } = await supabaseNavegador().from("formularios").update(mudanca).eq("id", id).select(CAMPOS_FORMULARIO).single<Formulario>();
  return error || !data ? { erro: traduzirErroForm(error) } : { ok: data };
}

export async function excluirFormulario(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("formularios").delete().eq("id", id).select("id");
  if (error) return { erro: traduzirErroForm(error) };
  return data?.length ? { ok: true } : { erro: "Só admin e estrategista excluem formulários." };
}

// Devolve a lista de problemas (vazia = publicado).
export async function publicarFormulario(id: number): Promise<Resultado<string[]>> {
  const { data, error } = await supabaseNavegador().rpc("form_publicar", { p_id: id });
  return error ? { erro: traduzirErroForm(error) } : { ok: (data as string[] | null) ?? [] };
}

export async function despublicarFormulario(id: number): Promise<Resultado<true>> {
  const { error } = await supabaseNavegador().rpc("form_despublicar", { p_id: id });
  return error ? { erro: traduzirErroForm(error) } : { ok: true };
}

export async function excluirResposta(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("formulario_respostas").delete().eq("id", id).select("id");
  if (error) return { erro: traduzirErroForm(error) };
  return data?.length ? { ok: true } : { erro: "Só admin e estrategista excluem respostas." };
}
