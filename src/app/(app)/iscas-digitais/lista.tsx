"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialogo } from "@/components/dialogo";
import { IconeMais } from "@/components/icones";
import type { ContextoLeads } from "@/lib/dados-leads";
import { etapaDoPapel } from "@/lib/leads";
import { novaPergunta, type Formulario } from "@/lib/formularios";
import { criarFormulario, despublicarFormulario, excluirFormulario, publicarFormulario } from "@/lib/formularios-api";
import { doPerfil, perfilPadrao, perfilPorId } from "@/lib/perfis-proprios";
import { botao, botaoPrimario, campo, MenuAcoes } from "../planejador/ui";

type Contagem = Record<number, { concluidas: number; parciais: number }>;

export function situacao(f: Formulario): { rotulo: string; classe: string } {
  if (!f.publicado) return { rotulo: "Rascunho", classe: "bg-lane text-muted" };
  const p = f.publicado;
  const mudou =
    JSON.stringify([p.titulo, p.descricao, p.modo, p.tema, p.perguntas, p.final]) !==
    JSON.stringify([f.titulo, f.descricao, f.modo, f.tema, f.perguntas, f.final]);
  return mudou ? { rotulo: "No ar · alterações não publicadas", classe: "bg-warn-soft text-warn" } : { rotulo: "No ar", classe: "bg-ok-soft text-ok" };
}

export function ListaFormularios({ ctx, iniciais, contagem }: { ctx: ContextoLeads; iniciais: Formulario[]; contagem: Contagem }) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [novo, setNovo] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const visiveis = doPerfil(lista, ctx.perfilAtual);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const troca = (f: Formulario) => setLista((l) => l.map((x) => (x.id === f.id ? f : x)));

  async function alternar(f: Formulario) {
    if (f.publicado) {
      const r = await despublicarFormulario(f.id);
      if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
      troca({ ...f, publicado: null, publicado_em: null });
      return setAviso({ tipo: "ok", texto: `"${f.titulo}" saiu do ar. O link mostra "indisponível".` });
    }
    const r = await publicarFormulario(f.id);
    if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
    if (r.ok!.length) return setAviso({ tipo: "erro", texto: `Antes de publicar: ${r.ok!.join(" ")}` });
    setAviso({ tipo: "ok", texto: `"${f.titulo}" está no ar.` });
    router.refresh();
  }

  async function duplicar(f: Formulario) {
    const r = await criarFormulario(`${f.titulo} (cópia)`.slice(0, 120), {
      descricao: f.descricao, modo: f.modo, tema: f.tema, perguntas: f.perguntas, final: f.final,
      pipeline_id: f.pipeline_id, etapa_id: f.etapa_id, responsavel: f.responsavel, perfil_id: f.perfil_id, etiqueta: f.etiqueta,
    });
    if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
    setLista((l) => [r.ok!, ...l]);
    setAviso({ tipo: "ok", texto: "Cópia criada como rascunho." });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{visiveis.length} {visiveis.length === 1 ? "formulário" : "formulários"}</p>
        {ctx.editaFormularios && (
          <button type="button" onClick={() => setNovo(true)} className={botaoPrimario}>
            <IconeMais /> Novo formulário
          </button>
        )}
      </div>
      {aviso && <p role={aviso.tipo === "erro" ? "alert" : "status"} className={`rounded-md px-4 py-2 text-sm ${aviso.tipo === "erro" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"}`}>{aviso.texto}</p>}

      {visiveis.length === 0 ? (
        <div className="rounded-balao border border-dashed border-line px-6 py-10 text-center">
          <p className="font-medium">Nenhum formulário ainda.</p>
          <p className="mt-1 text-sm text-muted">Crie uma isca: um formulário curto que entrega um material e coloca quem responde no funil de Leads.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {visiveis.map((f) => {
            const s = situacao(f);
            const c = contagem[f.id] ?? { concluidas: 0, parciais: 0 };
            const link = `${origem}/f/${f.slug}`;
            const perfil = perfilPorId(ctx.perfis, f.perfil_id);
            const etapa = ctx.etapas.find((e) => e.id === f.etapa_id);
            return (
              <li key={f.id} className="grid gap-3 rounded-balao border border-line bg-surface p-4 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="grid min-w-0 gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/iscas-digitais/${f.id}`} className="truncate font-semibold hover:text-accent-strong">{f.titulo}</Link>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.classe}`}>{s.rotulo}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="truncate font-mono">/f/{f.slug}</span>
                    <span>{c.concluidas} {c.concluidas === 1 ? "resposta" : "respostas"}{c.parciais ? ` · ${c.parciais} sem terminar` : ""}</span>
                    <span>{f.visitas} {f.visitas === 1 ? "visita" : "visitas"}</span>
                    {f.pipeline_id ? <span>Leads entram em {etapa?.nome ?? "?"}</span> : <span>Não cria leads</span>}
                    {perfil && <span>via @{perfil.handle}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {f.publicado && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(link).then(() => setAviso({ tipo: "ok", texto: "Link copiado." }))}
                      className={`${botao} border border-line hover:border-accent`}
                    >
                      Copiar link
                    </button>
                  )}
                  <Link href={`/iscas-digitais/${f.id}/respostas`} className={`${botao} border border-line hover:border-accent`}>Respostas</Link>
                  {ctx.editaFormularios && <Link href={`/iscas-digitais/${f.id}`} className={`${botao} border border-line hover:border-accent`}>Editar</Link>}
                  <MenuAcoes
                    rotulo={`Ações de ${f.titulo}`}
                    itens={[
                      { rotulo: "Abrir o formulário", acao: () => window.open(link, "_blank", "noopener"), oculto: !f.publicado },
                      { rotulo: f.publicado ? "Tirar do ar" : "Publicar", acao: () => alternar(f), oculto: !ctx.editaFormularios },
                      { rotulo: "Duplicar", acao: () => duplicar(f), oculto: !ctx.editaFormularios },
                      {
                        rotulo: "Excluir",
                        perigo: true,
                        oculto: !ctx.perm.gestor,
                        acao: async () => {
                          if (!confirm(`Excluir "${f.titulo}" e as ${c.concluidas + c.parciais} respostas dele? Os leads criados continuam no funil.`)) return;
                          const r = await excluirFormulario(f.id);
                          if (r.erro) return setAviso({ tipo: "erro", texto: r.erro });
                          setLista((l) => l.filter((x) => x.id !== f.id));
                        },
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {novo && <NovoFormulario ctx={ctx} aoFechar={() => setNovo(false)} aoCriar={(f) => router.push(`/iscas-digitais/${f.id}`)} />}
    </div>
  );
}

function NovoFormulario({ ctx, aoFechar, aoCriar }: { ctx: ContextoLeads; aoFechar: () => void; aoCriar: (f: Formulario) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  return (
    <Dialogo titulo="Novo formulário" aoFechar={aoFechar} descricao="Dê um nome. Perguntas, aparência e o funil você ajusta no editor.">
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const titulo = String(fd.get("titulo") ?? "").trim();
          if (!titulo) return setErro("Dê um nome ao formulário.");
          const isca = fd.get("modelo") === "isca";
          const entrada = etapaDoPapel(ctx.etapas, "entrada");
          setSalvando(true);
          const r = await criarFormulario(
            titulo,
            isca
              ? {
                  // Isca: já nasce ligada ao funil de Social Selling, com as perguntas que criam o lead.
                  perguntas: [novaPergunta("boas_vindas"), novaPergunta("nome"), novaPergunta("instagram"), novaPergunta("telefone"), novaPergunta("termos")],
                  final: { titulo: "Pronto! Seu material está liberado.", texto: "Clique abaixo para acessar.", botao: "Acessar o material" },
                  pipeline_id: ctx.pipeline.id,
                  etapa_id: entrada?.id ?? null,
                  perfil_id: perfilPadrao(ctx.perfis, ctx.perfilAtual),
                }
              : { perguntas: [novaPergunta("texto_curto")], perfil_id: perfilPadrao(ctx.perfis, ctx.perfilAtual) },
          );
          setSalvando(false);
          if (r.erro) return setErro(r.erro);
          aoCriar(r.ok!);
        }}
      >
        <label className="grid gap-1 text-sm font-medium">
          Nome do formulário
          <input name="titulo" required maxLength={120} autoFocus className={campo} placeholder="Ex.: Simulador de carta para imóvel" />
        </label>
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">Este formulário entrega uma isca?</legend>
          <label className="flex items-start gap-2">
            <input type="radio" name="modelo" value="isca" defaultChecked className="mt-1" />
            <span><b>Sim.</b> Já vem com nome, Instagram, WhatsApp e aceite, e cada resposta entra no funil de Leads com a etiqueta do formulário.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="modelo" value="livre" className="mt-1" />
            <span><b>Não.</b> Começa em branco e não cria leads (dá para ligar ao funil depois).</span>
          </label>
        </fieldset>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className={`${botao} border border-line`}>Cancelar</button>
          <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? "Criando…" : "Criar e editar"}</button>
        </div>
      </form>
    </Dialogo>
  );
}
