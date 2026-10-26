import type { Metadata } from "next";
import { AreaEmBreve } from "@/components/em-breve";

export const metadata: Metadata = { title: "Arsenal de Stories · Em breve" };

export default function ArsenalDeStoriesPage() {
  return (
    <AreaEmBreve
      titulo="Arsenal de Stories"
      resumo="Um repertório de ideias e sequências de stories prontas para a equipe usar no dia a dia."
      itens={[
        "Biblioteca de formatos de stories organizada por objetivo.",
        "Sequências prontas para adaptar e agendar.",
        "Ligação com as tarefas do Planejador.",
      ]}
    />
  );
}
