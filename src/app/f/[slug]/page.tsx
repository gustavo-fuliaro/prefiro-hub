import type { Metadata } from "next";
import { FormularioPublicoView } from "@/components/formulario-publico";
import type { FormularioPublico } from "@/lib/formularios";
import { createClient } from "@/lib/supabase/server";

// Formulário público (sem login). Só aparece a versão publicada.
export const dynamic = "force-dynamic";

async function carregar(slug: string): Promise<FormularioPublico | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("form_publico", { p_slug: slug });
  return (data as FormularioPublico | null) ?? null;
}

// Título e descrição aparecem na prévia do link no WhatsApp e nas redes.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const form = await carregar((await params).slug);
  return {
    title: { absolute: form?.titulo ?? "Formulário" },
    description: form?.descricao ?? "Responda em menos de um minuto.",
    robots: { index: false, follow: false },
    openGraph: form ? { title: form.titulo, description: form.descricao ?? "Responda em menos de um minuto.", type: "website" } : undefined,
  };
}

export default async function FormularioPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const form = await carregar((await params).slug);
  if (!form) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#141414] px-6 text-center text-[#f5f5f4]">
        <div className="grid gap-2">
          <h1 className="text-2xl font-bold">Formulário indisponível</h1>
          <p className="text-[#a8a29e]">Este formulário não existe ou não está mais no ar.</p>
        </div>
      </main>
    );
  }
  return <FormularioPublicoView form={form} />;
}
