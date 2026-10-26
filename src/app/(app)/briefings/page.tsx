import type { Metadata } from "next";
import { AreaEmBreve } from "@/components/em-breve";

export const metadata: Metadata = { title: "Briefing · Em breve" };

// Área bloqueada. Os briefings já salvos continuam guardados no banco (hub.briefings) e voltam quando a área abrir.
export default function BriefingPage() {
  return (
    <AreaEmBreve
      titulo="Briefing"
      resumo="Os briefings de gravação estão sendo refeitos para conversar com as tarefas do Planejador. Nenhum briefing salvo foi apagado."
      itens={[
        "Briefing ligado a cada tarefa do Planejador, com roteiro, local e checklist de gravação.",
        "Checklist de equipamentos e de pré-produção marcado pela equipe.",
        "Histórico do que foi combinado para cada gravação.",
      ]}
    />
  );
}
