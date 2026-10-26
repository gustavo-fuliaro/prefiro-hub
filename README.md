# Prefiro Hub

Painel open source para acompanhar, comparar e planejar o conteúdo de vários perfis do Instagram. Feito pela Prefiro Consórcio e multiusuário: cada usuário tem um ambiente próprio e isolado.

## O que faz

| Tela | Para quê |
|---|---|
| **Perfis** | Cadastro e exclusão dos perfis (próprios, time, parceiros, concorrentes) e cockpit de cada um: seguidores, views, curtidas, comentários, posts por dia e engajamento no tempo, desempenho dos últimos 8 posts e posts com miniaturas. |
| **Comparativo** | Ranking e participação de cada perfil em audiência, crescimento, engajamento e volume de posts. |
| **Metas** | Alvos por perfil (seguidores, engajamento, posts no mês) com previsão de quando serão atingidos. |
| **Planejador** | Quadro de ideias por perfil, com arrastar e soltar, e ligação da ideia ao post publicado. |
| **Calendário** | Postagens planejadas de todos os perfis. |
| **Briefings** | Roteiro, checklist e ambiente de gravação de cada ideia. |
| **Progresso** | Relatório semanal automático (segunda, 8h): ganho de seguidores, posts, interações, melhores posts, metas e ideias publicadas. Dá para imprimir ou salvar em PDF. |
| **Notificações** (sino no topo) | Queda de seguidores, post acima da média, meta fora do ritmo, falha na coleta e relatório pronto, com contador de não lidas. |
| **Usuários** (só a conta principal) | Cadastrar, editar, bloquear, liberar e excluir usuários, e gerar senha provisória. |

## Multiusuário e isolamento

- Cada usuário pertence a uma **conta** (ambiente). Perfis, números coletados, posts, metas, ideias, briefings, relatórios e notificações pertencem a uma conta.
- O isolamento é feito no banco, por Row Level Security: toda consulta só enxerga a conta de quem está logado, seja pela tela, pela API ou por uma URL montada à mão. O mesmo @ pode ser monitorado por contas diferentes, cada uma com o próprio histórico.
- A **conta administradora principal** (`super_admin`) gerencia os usuários pela aba Usuários, sem acesso aos dados dos outros ambientes. Criar, bloquear, redefinir senha e excluir passam pela Edge Function `admin-usuarios`, que confere quem chama e usa a chave de serviço só no servidor.
- Senhas ficam no Supabase Auth (hash bcrypt). O admin gera uma senha provisória; no primeiro acesso, o Hub obriga a pessoa a criar a própria senha.
- Usuário bloqueado perde o acesso aos dados na hora (o banco deixa de liberar) e não consegue mais entrar (login banido) até ser liberado.

## Como funciona

- **Next.js 15** (App Router, TypeScript, Tailwind 4) para o site.
- **Supabase** para login, banco (Postgres com Row Level Security), arquivos, Edge Functions e rotinas agendadas (`pg_cron` + `pg_net`).
- Todas as tabelas ficam no schema `hub`, separado de qualquer outra tabela do projeto.
- Dados do Instagram vêm só da **API oficial da Meta** (Graph API com Business Discovery). Nada de raspagem. Só contas Business ou Creator podem ser lidas.
- Segredos (token da Meta) ficam no **Vault do Supabase**, nunca no código nem no navegador.

### Rotinas automáticas

| Horário (Brasília) | Rotina |
|---|---|
| Todo dia, 06:00 | `coletar-perfis`: seguidores, posts e métricas (curtidas, comentários, views de Reels) de cada perfil ativo, de todas as contas |
| Todo dia, 06:20 | `hub.gerar_alertas()` |
| Segunda, 08:00 | `hub.gerar_relatorio_semanal()` para a semana anterior, um relatório por conta |

## Papéis

| Papel | Pode |
|---|---|
| `admin` | Tudo dentro do próprio ambiente (usuários novos entram como admin do ambiente deles) |
| `estrategista` | Cadastrar e excluir perfis, metas; gerar relatórios; criar conteúdo |
| `criador` | Criar e editar ideias e briefings |
| `leitura` | Só ver |

As regras ficam no banco (Row Level Security), não só na tela.

## Instalação

Você vai precisar de: um projeto no [Supabase](https://supabase.com) (o plano gratuito serve para começar), um app na [Meta for Developers](https://developers.facebook.com) ligado a uma conta Instagram Business, Node.js 20 ou mais novo.

### 1. Banco

1. Em *Database › Extensions*, ative `pg_cron` e `pg_net`.
2. Rode os arquivos de `supabase/migrations/` em ordem de nome (SQL Editor ou `supabase db push`).
3. Em *Project Settings › Data API › Exposed schemas*, adicione `hub`.
4. Crie seu usuário em *Authentication › Users* e rode `supabase/seed/primeiro_admin.sql` com o nome da empresa, o seu nome e o seu e-mail. Isso cria o ambiente da empresa e faz de você a conta administradora principal.

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
supabase functions deploy admin-usuarios --no-verify-jwt
```

As duas checam o acesso por conta própria (segredo do cron, login de admin/estrategista ativo ou da conta administradora principal), por isso o `--no-verify-jwt`.

### 4. Rotinas

No SQL Editor, rode uma vez cada arquivo de `supabase/seed/`, trocando os marcadores indicados no topo de cada um:

- `agendar_coleta.sql` (troque `SEU-PROJETO` e `SEU_IG_USER_ID`)
- `agendar_alertas.sql`
- `agendar_relatorio.sql`

### 5. Site

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
- Isolamento entre contas no banco (RLS por `conta_id`), testado com tentativas de leitura, alteração e exclusão cruzadas.
- Gestão de usuários só pela Edge Function `admin-usuarios`; a chave de serviço nunca vai ao navegador.
- Recomendado: ativar *Leaked password protection* em *Authentication › Settings*.
- Só dados públicos de perfis de terceiros são guardados, sem dados de seguidores individuais (LGPD).

## Custos de referência

Supabase gratuito ou Pro e uma hospedagem Node.js que você já tenha. A coleta usa a API oficial da Meta, sem custo; todas as contas compartilham o limite de chamadas do token configurado.

## Licença

[GNU AGPL-3.0](LICENSE). Você pode usar, modificar e hospedar o Prefiro Hub livremente. Se oferecer uma versão modificada para outras pessoas usarem pela internet, precisa disponibilizar o código-fonte dessa versão sob a mesma licença. O menu do app tem um link "Código-fonte"; numa versão modificada, aponte-o para o seu repositório com a variável `NEXT_PUBLIC_CODIGO_FONTE_URL`.

Copyright (C) 2026 Prefiro Consórcio.
