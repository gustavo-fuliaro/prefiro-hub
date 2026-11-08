// Leitura e gravação de leads pelo navegador. As regras ficam no banco (RLS, gatilhos e funções);
// aqui só traduzimos os erros para frases que a equipe entende.
import { CAMPOS_LEAD, type ColunaRascunho, type EventoLead, type Lead } from "@/lib/leads";
import { supabaseNavegador } from "@/lib/tarefas-api";

export type NotaLead = { id: number; lead_id: number; autor: string | null; autor_nome: string; texto: string; criado_em: string };
type Resultado<T> = { ok: T; erro?: undefined } | { ok?: undefined; erro: string };

export function traduzirErroLead(e: { code?: string; message?: string } | null): string {
  if (!e) return "Algo deu errado. Tente de novo.";
  const msg = e.message ?? "";
  // Mensagens escritas pelo próprio banco (exigências da etapa, funil, perfil) já estão em português.
  if (/^(Para entrar|Para trocar|Este funil|A etapa|O perfil|Só |Escolha|Uma coluna|O funil|A primeira|Dê um nome|O prazo|Coluna|"|Lead não)/.test(msg)) return msg;
  if (e.code === "23505") return "Este @ já está cadastrado como lead neste ambiente. Use a busca para encontrá-lo.";
  if (e.code === "42501" || /row-level security|permission/i.test(msg)) return "Seu papel não permite esta ação neste lead.";
  if (e.code === "23514") return "Algum campo está fora do formato aceito. Confira o @, o e-mail e o telefone.";
  if (e.code === "PGRST116") return "Este lead não existe mais ou você não pode mexer nele (só o responsável ou a gestão).";
  return "Não foi possível salvar. Confira a conexão e tente de novo.";
}

export async function criarLead(dados: Partial<Lead>): Promise<Resultado<Lead>> {
  const { data, error } = await supabaseNavegador().from("leads").insert(dados).select(CAMPOS_LEAD).single<Lead>();
  return error || !data ? { erro: traduzirErroLead(error) } : { ok: data };
}

export async function atualizarLead(id: number, mudanca: Partial<Lead>): Promise<Resultado<Lead>> {
  const { data, error } = await supabaseNavegador().from("leads").update(mudanca).eq("id", id).select(CAMPOS_LEAD).single<Lead>();
  return error || !data ? { erro: traduzirErroLead(error) } : { ok: data };
}

export async function lerLead(id: number): Promise<Resultado<Lead>> {
  const { data, error } = await supabaseNavegador().from("leads").select(CAMPOS_LEAD).eq("id", id).single<Lead>();
  return error || !data ? { erro: traduzirErroLead(error) } : { ok: data };
}

export async function excluirLead(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("leads").delete().eq("id", id).select("id");
  if (error) return { erro: traduzirErroLead(error) };
  return data?.length ? { ok: true } : { erro: "Só a gestão (admin e estrategista) exclui leads." };
}

// Assumir: o banco garante um dono só, mesmo com duas pessoas clicando ao mesmo tempo.
export async function assumirLead(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().rpc("assumir_lead", { p_lead: id });
  if (error) return { erro: traduzirErroLead(error) };
  const r = data as { ok: boolean; motivo?: string; dono_nome?: string };
  if (r.ok) return { ok: true };
  if (r.motivo === "desqualificado") return { erro: "Lead desqualificado não pode ser assumido." };
  return { erro: `Este lead acabou de ser assumido por ${r.dono_nome ?? "outra pessoa"}.` };
}

export async function lerNotas(leadId: number): Promise<Resultado<NotaLead[]>> {
  const { data, error } = await supabaseNavegador()
    .from("lead_notas").select("id, lead_id, autor, autor_nome, texto, criado_em").eq("lead_id", leadId)
    .order("criado_em", { ascending: true }).order("id", { ascending: true }).returns<NotaLead[]>();
  return error ? { erro: traduzirErroLead(error) } : { ok: data ?? [] };
}

export async function anotar(leadId: number, texto: string): Promise<Resultado<NotaLead>> {
  const { data, error } = await supabaseNavegador()
    .from("lead_notas").insert({ lead_id: leadId, texto }).select("id, lead_id, autor, autor_nome, texto, criado_em").single<NotaLead>();
  return error || !data ? { erro: traduzirErroLead(error) } : { ok: data };
}

export async function apagarNota(id: number): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("lead_notas").delete().eq("id", id).select("id");
  if (error) return { erro: traduzirErroLead(error) };
  return data?.length ? { ok: true } : { erro: "Você só pode excluir as próprias notas." };
}

export async function lerEventosLead(leadId: number): Promise<Resultado<EventoLead[]>> {
  const { data, error } = await supabaseNavegador()
    .from("lead_eventos").select("id, lead_id, tipo, de, para, detalhe, autor_nome, criado_em").eq("lead_id", leadId)
    .order("criado_em", { ascending: false }).order("id", { ascending: false }).limit(100).returns<EventoLead[]>();
  return error ? { erro: traduzirErroLead(error) } : { ok: data ?? [] };
}

export async function salvarEtapas(pipelineId: number, colunas: ColunaRascunho[]): Promise<Resultado<true>> {
  const { error } = await supabaseNavegador().rpc("salvar_etapas", { p_pipeline: pipelineId, p_etapas: colunas });
  return error ? { erro: traduzirErroLead(error) } : { ok: true };
}

export async function salvarFunil(pipelineId: number, mudanca: { expira_para_base: boolean; vida_max_h: number | null }): Promise<Resultado<true>> {
  const { data, error } = await supabaseNavegador().from("lead_pipelines").update(mudanca).eq("id", pipelineId).select("id");
  if (error) return { erro: traduzirErroLead(error) };
  return data?.length ? { ok: true } : { erro: "Só admins configuram os funis." };
}
