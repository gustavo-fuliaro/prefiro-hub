---
name: Prefiro Hub
description: Painel interno da Prefiro Consórcio para acompanhar e planejar perfis do Instagram, na identidade visual da marca.
colors:
  laranja-institucional: "#ff7b00"
  laranja-texto: "#974500"
  laranja-claro: "#ffd8b3"
  laranja-bruma: "#fff1e3"
  cinza-escuro: "#424241"
  cinza-institucional: "#666666"
  cinza-claro: "#dcdcdb"
  cinza-linha-forte: "#c9c8c6"
  branco-premium: "#faf8f5"
  superficie: "#ffffff"
  faixa: "#f2efea"
  tinta: "#2f2f2e"
  tinta-sobre-laranja: "#1f1f1e"
  perigo: "#b3261e"
  sucesso: "#2e7d4f"
  aviso: "#8a5a00"
typography:
  display:
    fontFamily: "Sora, Inter, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Sora, Inter, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  title:
    fontFamily: "Sora, Inter, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  balao: "14px 14px 14px 4px"
  balao-sm: "12px 12px 12px 4px"
  md: "10px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.laranja-institucional}"
    textColor: "{colors.tinta-sobre-laranja}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  nav-item-active:
    backgroundColor: "{colors.laranja-institucional}"
    textColor: "{colors.tinta-sobre-laranja}"
    rounded: "{rounded.balao-sm}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.balao}"
    padding: "16px"
  input:
    backgroundColor: "{colors.branco-premium}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  chip-destaque:
    backgroundColor: "{colors.laranja-claro}"
    textColor: "{colors.laranja-texto}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Prefiro Hub

## Overview

**Creative North Star: "Diálogo que aproxima"**

O Hub é uma ferramenta de trabalho da Prefiro Consórcio, e fala como a marca. O balão de fala do logotipo é a gramática da interface: contêineres e o item ativo do menu têm cantos arredondados com uma "ponta" no inferior esquerdo, e a estrela do símbolo marca quem lidera. A marca vive nos detalhes; a estrutura é a de um painel claro e previsível, com a navegação no mesmo lugar em todas as telas.

O fundo é o branco premium do manual, as superfícies são brancas e o trilho lateral é o cinza escuro institucional com o logotipo negativo. O laranja institucional é reservado para ação, seleção e a série principal dos gráficos. A densidade é de ferramenta de escritório: números legíveis de relance, tabelas que rolam dentro do próprio cartão, nenhuma decoração entre a pessoa e o dado. O único lugar onde a marca fala alto é o login, com o mosaico de formas do manual sobre o gradiente oficial.

Identidade fixada pelo Manual de Identidade Visual Prefiro Consórcio v1.0 (2026); não é um tema trocável.

**Key Characteristics:**
- Trilho escuro (#424241) com logotipo negativo oficial e respiro do tamanho do balão.
- Cantos em balão (ponta no inferior esquerdo) em cartões, diálogos e item ativo.
- Sora nos títulos e números, Inter no texto, algarismos tabulares em dados.
- Estrela laranja marcando o líder; três linhas de mensagem como indicador de carregamento.
- Modo escuro derivado dos cinzas da marca, com o trilho no mesmo cinza escuro.

## Colors

Paleta institucional da Prefiro: um laranja protagonista sobre neutros quentes, com cinzas que dão credibilidade.

### Primary
- **Laranja Institucional** (#ff7b00): botão primário, item ativo do menu, foco de campos, contorno de seleção, estrela de líder, série 1 dos gráficos. Texto sobre ele sempre na Tinta sobre Laranja (#1f1f1e), nunca branco (contraste).
- **Laranja para Texto** (#974500): links, rótulos e números em laranja. É a versão acessível do laranja para texto sobre branco e sobre o Laranja Claro.

### Secondary
- **Laranja Claro** (#ffd8b3): seleção de texto, chips de destaque e fundo do item selecionado em controles segmentados.
- **Laranja Bruma** (#fff1e3): fundo da "fala" de destaques do relatório, do gancho do roteiro e da coluna do planejador ao arrastar.

### Neutral
- **Cinza Escuro** (#424241): trilho lateral (claro e escuro); série 2 dos gráficos.
- **Cinza Institucional** (#666666): textos secundários e descrições.
- **Tinta** (#2f2f2e): texto principal.
- **Branco Premium** (#faf8f5): fundo da aplicação.
- **Superfície** (#ffffff): cartões, tabelas e diálogos.
- **Faixa** (#f2efea): colunas do planejador.
- **Cinza Claro** (#dcdcdb) e **Linha Forte** (#c9c8c6): bordas e divisórias.
- **Estados:** Perigo (#b3261e), Sucesso (#2e7d4f), Aviso (#8a5a00), cada um com fundo suave próprio.

### Named Rules
**The Laranja Tem Função Rule.** O laranja institucional aparece onde há ação, seleção ou liderança. Nunca como enfeite de fundo dentro das telas de trabalho.

**The Gradiente Só no Fundo Rule.** O gradiente oficial (#f26a00 → #ffb347) só aparece em fundos e elementos gráficos (hoje, o painel do login). Nunca sobre ou dentro do logotipo.

## Typography

**Display Font:** Sora (com Inter e Segoe UI de reserva)
**Body Font:** Inter (com Segoe UI e system-ui de reserva)

**Character:** Sora, geométrica e contemporânea, dá voz aos títulos e aos números grandes; Inter, neutra e muito legível, carrega tudo o que se lê em sequência.

### Hierarchy
- **Display** (700, 2rem, 1.25): título de cada tela.
- **Headline** (700, 1.5rem): números de destaque (KPIs) e títulos de diálogo.
- **Title** (700, 1.125rem): títulos de seção e de coluna.
- **Body** (400, 1rem, 1.5): textos e descrições; descrição do cabeçalho limitada a 48ch para a ação caber ao lado do título.
- **Label** (600, 0.75rem, 0.025em, caixa alta): rótulos de KPI e cabeçalhos de tabela.

### Named Rules
**The Número Tabular Rule.** Todo dado numérico usa algarismos tabulares, e colunas numéricas não quebram linha.

## Layout

Casco em duas colunas a partir de 768px: trilho fixo de 248px (rola sozinho em telas baixas) e conteúdo com 40–48px de margem lateral. Abaixo de 768px o trilho vira uma barra superior com o menu rolando na horizontal, sem barra de rolagem visível. As grades de conteúdo de 3 ou 4 colunas abrem em `lg` (1024px), não em `md`, porque o trilho consome parte da largura. Grades de página nunca crescem além da tela: uma tabela larga rola dentro do próprio cartão. Ritmo de espaçamento em 4/8/16/24/48px, com mais espaço acima de um título que abaixo.

## Elevation & Depth

Profundidade suave e quente: superfícies brancas sobre o branco premium, com sombra baixa em cartões e uma sombra mais funda só para o que flutua.

### Shadow Vocabulary
- **Cartão** (`box-shadow: 0 1px 2px rgb(66 66 65 / 0.06), 0 4px 14px -6px rgb(66 66 65 / 0.12)`): cartões, tabelas, controles segmentados.
- **Flutuante** (`box-shadow: 0 2px 4px rgb(66 66 65 / 0.08), 0 18px 40px -16px rgb(66 66 65 / 0.28)`): diálogos e cartões do planejador ao passar o mouse.

## Shapes

A forma-assinatura é o balão de fala: cantos de 14px com o inferior esquerdo em 4px (12px/4px nos elementos menores). Controles (botões, campos, abas) usam 10px uniformes; contadores e chips usam pílula. As formas gráficas do manual (balão, estrela, quartos de círculo, ondas, três linhas) são usadas inteiras e sem distorção.

## Components

### Buttons
- **Shape:** cantos suaves (10px).
- **Primary:** Laranja Institucional com texto Tinta sobre Laranja, semibold.
- **Secondary:** superfície branca com borda Cinza Claro; a borda acende em laranja no hover.
- **Press:** escala 0.97 por 160ms com ease-out forte (cubic-bezier(0.23, 1, 0.32, 1)).

### Chips
- **Destaque:** Laranja Claro com texto Laranja para Texto, pílula.
- **Severidade (alertas):** fundo suave do estado com um ponto da cor do estado; nunca faixa lateral colorida.

### Cards / Containers
- **Corner Style:** balão (14px, ponta 4px).
- **Background:** Superfície; a "fala" de destaques usa Laranja Bruma.
- **Shadow Strategy:** Cartão (ver Elevation).
- **Border:** 1px Cinza Claro.
- **Internal Padding:** 16–20px.

### Inputs / Fields
- **Style:** borda Cinza Claro, fundo Branco Premium ou Superfície, 10px.
- **Focus:** borda laranja com halo laranja translúcido de 3px; cursor de texto laranja.

### Navigation
- **Trilho:** Cinza Escuro, texto claro; item ativo em balão laranja sólido com texto escuro; hover em cinza um tom acima. Contador de alertas em pílula vermelha; cadeado do Estúdio quando bloqueado.

### Fala da Prefiro
Bloco de destaques do relatório semanal: balão em Laranja Bruma com a estrela laranja à esquerda.

## Do's and Don'ts

### Do:
- **Do** usar o logotipo só a partir de `public/marca/` (positivo em fundo claro, negativo em fundo escuro), com respiro do tamanho do balão.
- **Do** marcar o primeiro colocado com a estrela em um balão laranja.
- **Do** usar ícones de traço único (2px, pontas arredondadas) de `src/components/icones.tsx`.
- **Do** entrar o conteúdo da página uma vez por navegação (260ms, 6px), e respeitar prefers-reduced-motion.

### Don't:
- **Don't** alterar cores, proporções ou diagramação do logotipo, nem colocá-lo sobre o gradiente.
- **Don't** usar texto branco sobre o laranja institucional.
- **Don't** usar faixa lateral colorida (border-left grossa) em cartões, alertas ou listas.
- **Don't** usar rótulo em caixa alta acima de um título (sobretítulo).
- **Don't** usar caracteres Unicode ou emoji no lugar de ícones.
