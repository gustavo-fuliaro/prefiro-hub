import type { Metadata } from "next";
import { AreaEmBreve } from "@/components/em-breve";

export const metadata: Metadata = { title: "Iscas Digitais · Em breve" };

export default function IscasDigitaisPage() {
  return (
    <AreaEmBreve
      titulo="Iscas Digitais"
      resumo="Um espaço para planejar e acompanhar materiais de captação, como e-books, checklists e simuladores."
      itens={[
        "Cadastro das iscas com objetivo, público e status.",
        "Ligação com os conteúdos que divulgam cada isca.",
        "Acompanhamento da produção junto com o Planejador.",
      ]}
    />
  );
}
