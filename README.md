# Prefiro Hub

Painel open source para acompanhar, comparar e planejar o conteúdo de vários perfis do Instagram. Feito pela Prefiro Consórcio para uso interno, e aberto para outras empresas instalarem.

## O que faz

| Tela | Para quê |
|---|---|
| **Perfis** | Cadastro dos perfis (próprios, time, parceiros, concorrentes) e cockpit de cada um: seguidores, evolução, farol, posts com miniaturas. |
| **Comparativo** | Ranking e participação de cada perfil em audiência, crescimento, engajamento e volume de posts. |
| **Metas** | Alvos por perfil (seguidores, engajamento, posts no mês) com previsão de quando serão atingidos. |
| **Alertas** | Queda de seguidores, post acima da média, meta fora do ritmo, falha na coleta e relatório pronto. |
| **Planejador** | Quadro de ideias por perfil, com arrastar e soltar, e ligação da ideia ao post publicado. |
| **Calendário** | Postagens planejadas de todos os perfis. |
| **Briefings** | Roteiro, checklist e ambiente de gravação de cada ideia. |
| **Estratégia** | Posicionamento e pilares de conteúdo de cada perfil. |
| **Estúdio de IA** | Ideias, roteiros e leitura dos posts escritos com o Claude, usando o posicionamento e os números do perfil. Tem cadeado: só funciona depois que um admin libera. |
| **Progresso** | Relatório semanal automático (segunda, 8h): ganho de seguidores, posts, interações, melhores posts, metas e ideias publicadas. Dá para imprimir ou salvar em PDF. |

## Como funciona

- **Next.js 15** (App Router, TypeScript, Tailwind 4) para o site.
- **Supabase** para login, banco (Postgres com Row Level Security), arquivos, Edge Functions e rotinas agendadas (`pg_cron` + `pg_net`).
- Todas as tabelas ficam no schema `hub`, separado de qualquer outra tabela do projeto.
- Dados do Instagram vêm só da **API oficial da Meta** (Graph API com Business Discovery). Nada de raspagem. Só contas Business ou Creator podem ser lidas.
- Segredos (token da Meta, chave da Anthropic) ficam no **Vault do Supabase**, nunca no código nem no navegador.

### Rotinas automáticas

| Horário (Brasília) | Rotina |
|---|---|
| Todo dia, 06:00 | `coletar-perfis`: seguidores, posts e métricas de cada perfil ativo |
| Todo dia, 06:20 | `hub.gerar_alertas()` |
| Segunda, 08:00 | `hub.gerar_relatorio_semanal()` para a semana anterior |

## Papéis

| Papel | Pode |
|---|---|
| `admin` | Tudo, inclusive liberar ou bloquear o Estúdio de IA |
| `estrategista` | Cadastrar perfis, metas e posicionamento; gerar relatórios; criar conteúdo |
| `criador` | Criar e editar ideias, briefings e materiais; usar o Estúdio |
| `leitura` | Só ver |

As regras ficam no banco (Row Level Security), não só na tela.

## Instalação

Você vai precisar de: um projeto no [Supabase](https://supabase.com) (o plano gratuito serve para começar), um app na [Meta for Developers](https://developers.facebook.com) ligado a uma conta Instagram Business, Node.js 20 ou mais novo e, para o Estúdio, uma chave da API da Anthropic com créditos.

### 1. Banco

1. Em *Database › Extensions*, ative `pg_cron` e `pg_net`.
2. Rode os arquivos de `supabase/migrations/` em ordem de nome (SQL Editor ou `supabase db push`).
3. Em *Project Settings › Data API › Exposed schemas*, adicione `hub`.
4. Crie seu usuário em *Authentication › Users* e rode `supabase/seed/primeiro_admin.sql` com o seu e-mail.

### 2. Meta (coleta)

1. Crie um app do tipo *Empresa* na Meta for Developers e adicione o produto *Instagram Graph API*.
2. No Gerenciador de Negócios, crie um **usuário do sistema**, dê acesso ao app e à página ligada à conta Instagram e gere um token **sem expiração** com `instagram_basic`, `pages_show_list`, `pages_read_engagement` e `business_management` (se disponível).
3. Em *Integrations › Vault* do Supabase, crie o segredo `meta_access_token` com esse token.
4. Descubra o id da conta Instagram Business (Graph API Explorer: `me/accounts?fields=instagram_business_account`).

### 3. Edge Functions

Com a [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase functions deploy coletar-perfis --no-verify-jwt
```

```bash
supabase functions deploy gerar-conteudo --no-verify-jwt
```

As duas checam o acesso por conta própria (segredo do cron ou login de um membro com papel permitido), por isso o `--no-verify-jwt`.

### 4. Rotinas

No SQL Editor, rode uma vez cada arquivo de `supabase/seed/`, trocando os marcadores indicados no topo de cada um:

- `agendar_coleta.sql` (troque `SEU-PROJETO` e `SEU_IG_USER_ID`)
- `agendar_alertas.sql`
- `agendar_relatorio.sql`

### 5. Estúdio de IA (opcional)

1. Crie uma chave em [console.anthropic.com](https://console.anthropic.com) e compre créditos em *Plans & Billing*.
2. Crie o segredo `anthropic_api_key` no Vault.
3. No Hub, entre como admin, abra **Estúdio de IA** e clique em **Liberar Estúdio**.

O Estúdio começa bloqueado. Enquanto estiver assim, ninguém consegue gerar, nem chamando a função direto.

### 6. Site

1. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável do projeto (*Project Settings › API Keys*).
2. Rode localmente:
   ```bash
   npm install
   ```
   ```bash
   npm run dev
   ```
   Abra http://localhost:3000.
3. **Publicar.** Qualquer hospedagem que rode Node.js 20+ serve (Hostinger Business/Cloud, Vercel, VPS). Comando de build `npm run build`, comando de início `npm start`, e as mesmas duas variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Em *Authentication › URL Configuration* do Supabase, coloque o endereço publicado em *Site URL*.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm start` | Roda o build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos |
| `npm test` | Testes (Vitest) |

## Segurança

- Row Level Security em todas as tabelas do `hub`; o navegador só usa a chave publicável.
- Coleta, alertas e relatório rodam no servidor (service role e `security definer` com `search_path` vazio).
- Segredos só no Vault, lidos por `hub.segredo()`, que só o service role executa e que só devolve nomes da lista permitida.
- Recomendado: ativar *Leaked password protection* em *Authentication › Settings*.
- Só dados públicos de perfis de terceiros são guardados, sem dados de seguidores individuais (LGPD).

## Custos de referência

Supabase gratuito ou Pro, hospedagem Node.js que você já tenha e a API da Anthropic por uso (estimativa: US$ 20 a 60 por mês para uma equipe pequena).

## Licença

[GNU AGPL-3.0](LICENSE). Você pode usar, modificar e hospedar o Prefiro Hub livremente. Se oferecer uma versão modificada para outras pessoas usarem pela internet, precisa disponibilizar o código-fonte dessa versão sob a mesma licença.

Copyright (C) 2026 Prefiro Consórcio.
