---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: ["src/app/login/page.tsx"]
---

# Shell do app (todas as telas autenticadas e login)

Modo: Operate. Equipe interna no computador, escritório com luz do dia. Mundo visual fixado pelo Manual de Identidade Prefiro Consórcio v1.0 (sem sorteio de direção). Redesenho só visual: telas, funções, textos e ordem do menu ficam como estão.

## Direction contract

THESIS: Uma ferramenta de trabalho que fala como a Prefiro: o balão de fala do logotipo vira a gramática da interface (cantos arredondados com a ponta do balão no canto inferior esquerdo) e a estrela marca quem lidera. Recusa o painel SaaS cinza com acento azul.

OWN-WORLD: Fundo branco premium #FAF8F5, superfícies brancas, linhas #DCDCDB. Trilho lateral em cinza escuro #424241 com o logotipo negativo oficial. Laranja institucional #FF7B00 em ações primárias, item ativo, foco e série principal dos gráficos; texto laranja só no tom escuro acessível. Laranja claro #FFD8B3 em seleções e destaques. Gradiente oficial só em fundo do login e destaques, nunca no logotipo. Sora em títulos e números grandes; Inter no texto, com algarismos tabulares. Cantos 14px com o inferior esquerdo em 4px (ponta do balão). Três linhas de mensagem como marcador de carregamento e vazio.

STORY: A pessoa abre o Hub, reconhece a Prefiro sem procurar, encontra cada tela no mesmo lugar de sempre, lê os números de relance e volta ao trabalho.

FIRST VIEWPORT: Trilho escuro de 248px à esquerda com o logotipo negativo no topo e respiro do tamanho do balão; menu na ordem atual, item ativo com fundo laranja sólido e ponta de balão; contador de alertas e cadeado do Estúdio no trilho; usuário, sair e código-fonte no pé. Conteúdo sobre o branco premium, título em Sora 32px, ação primária em laranja à direita do título quando houver. No celular o trilho vira barra superior com menu rolável.

SIGNATURE: Ponta de balão nos contêineres e no item ativo; estrela laranja marcando o líder (melhor post, maior ganho). Movimento: entrada do conteúdo da página (opacidade e 6px, 220ms, ease-out forte) uma vez por navegação; botões com escala 0.97 ao pressionar; diálogos entram de 0.96. Nada anima em ações de teclado; respeita prefers-reduced-motion.

FORM: Marca fixada pelo manual do cliente; nenhuma seed (direção pinada pela marca).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
