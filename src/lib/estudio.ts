// Reexporta a lógica compartilhada com a Edge Function (código puro, sem Deno).
export * from "../../supabase/functions/_shared/estudio";
import { PERGUNTAS_POSICIONAMENTO, type Pilar } from "../../supabase/functions/_shared/estudio";

// Limpa o que vem do formulário: só perguntas conhecidas, textos com tamanho máximo, até 6 pilares.
export function limparPosicionamento(entrada: { respostas: unknown; pilares: unknown }) {
  const respostas: Record<string, string> = {};
  const r = (entrada.respostas ?? {}) as Record<string, unknown>;
  for (const q of PERGUNTAS_POSICIONAMENTO) {
    const v = typeof r[q.id] === "string" ? (r[q.id] as string).trim().slice(0, 2000) : "";
    if (v) respostas[q.id] = v;
  }
  const pilares: Pilar[] = (Array.isArray(entrada.pilares) ? entrada.pilares : [])
    .map((item: unknown) => {
      const p = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        nome: typeof p.nome === "string" ? p.nome.trim().slice(0, 40) : "",
        descricao: typeof p.descricao === "string" ? p.descricao.trim().slice(0, 240) : "",
      };
    })
    .filter((p) => p.nome)
    .slice(0, 6);
  return { respostas, pilares };
}
