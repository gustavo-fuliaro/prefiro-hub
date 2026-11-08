"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialogo } from "@/components/dialogo";
import type { ContextoLeads } from "@/lib/dados-leads";
import { faltaParaEntrar, PRIORIDADE_LABEL, rotuloPrazo, situacaoPrazo, type Etapa, type Lead, type Prioridade } from "@/lib/leads";
import { atualizarLead } from "@/lib/leads-api";
import { perfilPorId } from "@/lib/perfis-proprios";
import { aoVivo } from "@/lib/tarefas-api";
import { botao, botaoPrimario, campo } from "../planejador/ui";

export type Ctx = ContextoLeads;

// Leads do ambiente em memória, atualizados ao vivo para toda a equipe.
export function useLeadsAoVivo(ctx: Ctx, iniciais: Lead[]) {
  const [leads, setLeads] = useState(() => new Map(iniciais.map((l) => [l.id, l])));
  const [conectado, setConectado] = useState(false);
  const aplicar = (l: Lead) =>
    setLeads((m) => {
      const atual = m.get(l.id);
      if (atual && atual.atualizado_em > l.atualizado_em) return m;
      return new Map(m).set(l.id, l);
    });
  const remover = (id: number) =>
    setLeads((m) => {
      if (!m.has(id)) return m;
      const novo = new Map(m);
      novo.delete(id);
      return novo;
    });
  useEffect(
    () =>
      aoVivo(`leads-${ctx.contaId}`, (c) =>
        c.on("postgres_changes", { event: "*", schema: "hub", table: "leads", filter: `conta_id=eq.${ctx.contaId}` }, (p) => {
          if (p.eventType === "DELETE") remover((p.old as { id: number }).id);
          else aplicar(p.new as Lead);
        }), setConectado),
    [ctx.contaId],
  );
  return { leads, aplicar, remover, conectado };
}

// Relógio da tela: os prazos se atualizam sozinhos a cada minuto.
export function useAgora(): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

// Mover de etapa: se a etapa pede algo que o lead não tem, abre um formulário curto antes.
export function useMoverLead(aoMudar: (l: Lead) => void) {
  const [pedido, setPedido] = useState<{ lead: Lead; etapa: Etapa } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function gravar(lead: Lead, etapa: Etapa, extra: Partial<Lead>) {
    setSalvando(true);
    setErro(null);
    const r = await atualizarLead(lead.id, { etapa_id: etapa.id, ...extra });
    setSalvando(false);
    if (r.erro) {
      setErro(r.erro);
      return false;
    }
    aoMudar(r.ok!);
    return true;
  }

  async function mover(lead: Lead, etapa: Etapa): Promise<string | null> {
    if (lead.etapa_id === etapa.id) return null;
    setErro(null);
    if (faltaParaEntrar(etapa, lead)) {
      setPedido({ lead, etapa });
      return null;
    }
    const r = await atualizarLead(lead.id, { etapa_id: etapa.id });
    if (r.erro) return r.erro;
    aoMudar(r.ok!);
    return null;
  }

  const falta = pedido ? faltaParaEntrar(pedido.etapa, pedido.lead) : null;
  const dialogo = pedido && falta && (
    <Dialogo titulo={`Mover para ${pedido.etapa.nome}`} largura="sm" aoFechar={() => setPedido(null)}
      descricao={falta === "justificativa" ? "Esta etapa pede o motivo." : falta === "contato" ? "Esta etapa pede telefone e e-mail do lead." : "Esta etapa pede a data para retomar o contato."}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const extra: Partial<Lead> =
            falta === "justificativa"
              ? { justificativa: String(fd.get("justificativa") ?? "").trim() || null }
              : falta === "contato"
                ? { telefone: String(fd.get("telefone") ?? "").trim() || null, email: String(fd.get("email") ?? "").trim() || null }
                : { data_retorno: String(fd.get("data_retorno") ?? "") || null };
          if (await gravar(pedido.lead, pedido.etapa, extra)) setPedido(null);
        }}
      >
        {falta === "justificativa" && (
          <label className="grid gap-1 text-sm font-medium">
            Motivo
            <textarea name="justificativa" required maxLength={1000} rows={3} autoFocus defaultValue={pedido.lead.justificativa ?? ""} className="rounded-md border border-line bg-bg px-3 py-2 font-normal" placeholder="Ex.: quer uma carta de R$ 300 mil para imóvel" />
          </label>
        )}
        {falta === "contato" && (
          <>
            <label className="grid gap-1 text-sm font-medium">
              Telefone
              <input name="telefone" type="tel" required maxLength={30} autoFocus defaultValue={pedido.lead.telefone ?? ""} className={campo} placeholder="(11) 99999-0000" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              E-mail
              <input name="email" type="email" required defaultValue={pedido.lead.email ?? ""} className={campo} />
            </label>
          </>
        )}
        {falta === "data_retorno" && (
          <label className="grid gap-1 text-sm font-medium">
            Retomar o contato em
            <input name="data_retorno" type="date" required autoFocus defaultValue={pedido.lead.data_retorno ?? ""} className={campo} />
          </label>
        )}
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setPedido(null)} className={`${botao} border border-line`}>Cancelar</button>
          <button type="submit" disabled={salvando} className={botaoPrimario}>{salvando ? "Movendo…" : "Mover"}</button>
        </div>
      </form>
    </Dialogo>
  );
  return { mover, dialogo };
}

export function ChipEtapa({ etapa }: { etapa: Pick<Etapa, "nome" | "cor"> | null | undefined }) {
  if (!etapa) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-lane px-2 py-0.5 text-[11px] font-semibold text-ink">
      <span aria-hidden className="size-2 rounded-full" style={{ background: etapa.cor }} />
      {etapa.nome}
    </span>
  );
}

const COR_PRAZO = { sem_prazo: "text-muted", ok: "text-muted", expirando: "font-semibold text-warn", vencido: "font-semibold text-danger" };
export function ChipPrazo({ expiraEm, agora }: { expiraEm: string | null; agora: number }) {
  if (!expiraEm) return null;
  return <span className={COR_PRAZO[situacaoPrazo(expiraEm, agora)]}>{rotuloPrazo(expiraEm, agora)}</span>;
}

export function ChipPrioridade({ p }: { p: Prioridade }) {
  if (p === "normal") return null;
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${p === "alta" ? "bg-danger-soft text-danger" : "bg-lane text-muted"}`}>
      {PRIORIDADE_LABEL[p]}
    </span>
  );
}

export function EtiquetaPerfilLead({ ctx, perfilId }: { ctx: Ctx; perfilId: number | null }) {
  const p = perfilPorId(ctx.perfis, perfilId);
  return (
    <span className={`inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${p ? "bg-accent-soft text-accent-strong" : "bg-lane text-muted"}`}>
      {p ? `via @${p.handle}` : "Sem perfil"}
    </span>
  );
}

export function useNomes(ctx: Ctx) {
  return useMemo(() => new Map(ctx.membros.map((m) => [m.user_id, m.nome])), [ctx.membros]);
}

// Início do dia local (para os filtros "hoje", "7 dias"...).
export function inicioDoDia(hoje: string, fuso: string): number {
  // Meio-dia UTC do dia local e volta até a meia-noite local: robusto para fusos de -12 a +12.
  const meioDia = Date.parse(`${hoje}T12:00:00Z`);
  const hora = Number(new Intl.DateTimeFormat("en-US", { timeZone: fuso, hour: "numeric", hourCycle: "h23" }).format(new Date(meioDia)));
  const min = Number(new Intl.DateTimeFormat("en-US", { timeZone: fuso, minute: "numeric" }).format(new Date(meioDia)));
  return meioDia - (hora * 60 + min) * 60_000;
}
