-- Prefiro Hub · schema inicial (Fase 0)
-- Tudo fica no schema "hub" para não tocar em tabelas que já existem no projeto (ranking_*, sdr_*).
-- Coleta (snapshots, posts, métricas, alertas) é escrita só pelo service role, que ignora RLS.

create schema if not exists hub;

-- ─── Membros e papéis ─────────────────────────────────────────────────────────
create table hub.membros (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nome      text not null check (length(nome) between 1 and 120),
  papel     text not null check (papel in ('admin', 'estrategista', 'criador', 'leitura')),
  criado_em timestamptz not null default now()
);

-- Papel do usuário logado (null = não é membro do Hub).
create or replace function hub.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel from hub.membros m where m.user_id = (select auth.uid())
$$;

create or replace function hub.pode(papeis text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(hub.papel_atual() = any (papeis), false)
$$;

-- ─── Perfis monitorados ──────────────────────────────────────────────────────
create table hub.perfis (
  id          bigint generated always as identity primary key,
  handle      text not null unique check (handle ~ '^[a-z0-9._]{1,30}$'),
  nome        text,
  ig_user_id  text,
  grupo       text not null check (grupo in ('proprio', 'time', 'parceiro', 'concorrente')),
  fonte       text not null default 'business_discovery'
              check (fonte in ('graph_api', 'business_discovery', 'windsor', 'manual')),
  responsavel uuid references hub.membros (user_id) on delete set null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  criado_por  uuid default auth.uid()
);

-- ─── Coleta ──────────────────────────────────────────────────────────────────
create table hub.snapshots_diarios (
  perfil_id      bigint not null references hub.perfis (id) on delete cascade,
  dia            date not null,
  seguidores     integer,
  seguindo       integer,
  total_posts    integer,
  alcance        integer,   -- só contas próprias
  visitas_perfil integer,   -- só contas próprias
  cliques_link   integer,   -- só contas próprias
  fonte          text not null,
  coletado_em    timestamptz not null default now(),
  primary key (perfil_id, dia)
);

create table hub.posts (
  id           text primary key,  -- media id da Meta
  perfil_id    bigint not null references hub.perfis (id) on delete cascade,
  tipo         text,              -- REELS, CAROUSEL_ALBUM, IMAGE
  legenda      text,
  permalink    text,
  thumb_path   text,              -- caminho no Storage (as URLs da Meta expiram)
  publicado_em timestamptz,
  pilar        text,
  formato      text
);
create index posts_perfil_publicado_idx on hub.posts (perfil_id, publicado_em desc);

create table hub.post_metricas (
  post_id           text not null references hub.posts (id) on delete cascade,
  dia               date not null,
  likes             integer,
  comentarios       integer,
  views             integer,
  salvamentos       integer,
  compartilhamentos integer,
  alcance           integer,
  primary key (post_id, dia)
);

create table hub.alertas (
  id        bigint generated always as identity primary key,
  perfil_id bigint references hub.perfis (id) on delete cascade,
  tipo      text not null,
  mensagem  text not null,
  criado_em timestamptz not null default now(),
  lido      boolean not null default false
);

-- ─── Planejamento ────────────────────────────────────────────────────────────
create table hub.ideias (
  id              bigint generated always as identity primary key,
  perfil_id       bigint not null references hub.perfis (id) on delete cascade,
  titulo          text not null check (length(titulo) between 1 and 200),
  gancho          text,
  tese            text,
  cta             text,
  formato         text,
  pilar           text,
  ambiente        text check (ambiente in ('casa', 'escritorio', 'rua', 'livre')),
  coluna          text not null default 'garagem' check (coluna in ('garagem', 'pista', 'chegada')),
  status_producao text check (status_producao in
                   ('a_gravar', 'gravado', 'aguardando_edicao', 'em_edicao', 'editado', 'aguardando_postagem', 'postado')),
  ordem           integer not null default 0,
  publicar_em     timestamptz,
  roteiro         jsonb,
  referencias     text[] not null default '{}',
  post_id         text references hub.posts (id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid default auth.uid()
);
create index ideias_perfil_coluna_idx on hub.ideias (perfil_id, coluna, ordem);
create index ideias_publicar_em_idx on hub.ideias (publicar_em) where publicar_em is not null;

create table hub.briefings (
  id            bigint generated always as identity primary key,
  ideia_id      bigint not null unique references hub.ideias (id) on delete cascade,
  checklist     jsonb not null default '{}',
  observacoes   text,
  atualizado_em timestamptz not null default now()
);

create table hub.posicionamento (
  perfil_id     bigint primary key references hub.perfis (id) on delete cascade,
  respostas     jsonb not null default '{}',
  pilares       jsonb not null default '[]',
  atualizado_em timestamptz not null default now()
);

create table hub.metas (
  id        bigint generated always as identity primary key,
  perfil_id bigint not null references hub.perfis (id) on delete cascade,
  metrica   text not null,
  alvo      numeric not null,
  prazo     date not null,
  criado_em timestamptz not null default now()
);

-- ─── IA ──────────────────────────────────────────────────────────────────────
create table hub.materiais_ia (
  id         bigint generated always as identity primary key,
  perfil_id  bigint not null references hub.perfis (id) on delete cascade,
  tipo       text not null,
  entrada    jsonb not null default '{}',
  saida      jsonb,
  status     text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);

create table hub.jobs (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null,
  payload    jsonb not null default '{}',
  status     text not null default 'pendente' check (status in ('pendente', 'rodando', 'concluido', 'erro')),
  resultado  jsonb,
  erro       text,
  criado_por uuid default auth.uid(),
  criado_em  timestamptz not null default now()
);

-- ─── atualizado_em automático ────────────────────────────────────────────────
create or replace function hub.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger ideias_atualizado_em before update on hub.ideias
  for each row execute function hub.tocar_atualizado_em();
create trigger briefings_atualizado_em before update on hub.briefings
  for each row execute function hub.tocar_atualizado_em();
create trigger posicionamento_atualizado_em before update on hub.posicionamento
  for each row execute function hub.tocar_atualizado_em();

-- ─── Market share (seguidores) ───────────────────────────────────────────────
create view hub.market_share_diario
with (security_invoker = true) as
select s.dia,
       p.id     as perfil_id,
       p.handle,
       p.grupo,
       s.seguidores,
       s.seguidores::numeric / nullif(sum(s.seguidores) over (partition by s.dia), 0) as share_seguidores
from hub.snapshots_diarios s
join hub.perfis p on p.id = s.perfil_id
where p.grupo in ('proprio', 'concorrente') and p.ativo;

-- ─── Permissões ──────────────────────────────────────────────────────────────
revoke all on schema hub from anon;
grant usage on schema hub to authenticated, service_role;
grant select, insert, update, delete on all tables in schema hub to authenticated;
grant all on all tables in schema hub to service_role;
grant usage, select on all sequences in schema hub to authenticated, service_role;
grant execute on function hub.papel_atual(), hub.pode(text[]) to authenticated;

alter table hub.membros           enable row level security;
alter table hub.perfis            enable row level security;
alter table hub.snapshots_diarios enable row level security;
alter table hub.posts             enable row level security;
alter table hub.post_metricas     enable row level security;
alter table hub.alertas           enable row level security;
alter table hub.ideias            enable row level security;
alter table hub.briefings         enable row level security;
alter table hub.posicionamento    enable row level security;
alter table hub.metas             enable row level security;
alter table hub.materiais_ia      enable row level security;
alter table hub.jobs              enable row level security;

-- Membros: todo membro vê a equipe; só admin cadastra ou altera.
create policy membros_ler on hub.membros for select to authenticated
  using (hub.papel_atual() is not null);
create policy membros_admin on hub.membros for all to authenticated
  using (hub.pode(array['admin'])) with check (hub.pode(array['admin']));

-- Leitura geral: qualquer membro lê.
create policy perfis_ler        on hub.perfis            for select to authenticated using (hub.papel_atual() is not null);
create policy snapshots_ler     on hub.snapshots_diarios for select to authenticated using (hub.papel_atual() is not null);
create policy posts_ler         on hub.posts             for select to authenticated using (hub.papel_atual() is not null);
create policy post_metricas_ler on hub.post_metricas     for select to authenticated using (hub.papel_atual() is not null);
create policy alertas_ler       on hub.alertas           for select to authenticated using (hub.papel_atual() is not null);
create policy ideias_ler        on hub.ideias            for select to authenticated using (hub.papel_atual() is not null);
create policy briefings_ler     on hub.briefings         for select to authenticated using (hub.papel_atual() is not null);
create policy posicionamento_ler on hub.posicionamento   for select to authenticated using (hub.papel_atual() is not null);
create policy metas_ler         on hub.metas             for select to authenticated using (hub.papel_atual() is not null);
create policy materiais_ler     on hub.materiais_ia      for select to authenticated
  using (hub.papel_atual() is not null and (status = 'publicado' or hub.pode(array['admin', 'estrategista', 'criador'])));
create policy jobs_ler          on hub.jobs              for select to authenticated using (criado_por = (select auth.uid()));

-- Escrita de cadastro e estratégia: admin e estrategista.
create policy perfis_escrever on hub.perfis for all to authenticated
  using (hub.pode(array['admin', 'estrategista'])) with check (hub.pode(array['admin', 'estrategista']));
create policy posicionamento_escrever on hub.posicionamento for all to authenticated
  using (hub.pode(array['admin', 'estrategista'])) with check (hub.pode(array['admin', 'estrategista']));
create policy metas_escrever on hub.metas for all to authenticated
  using (hub.pode(array['admin', 'estrategista'])) with check (hub.pode(array['admin', 'estrategista']));

-- Escrita de conteúdo: admin, estrategista e criador.
create policy ideias_escrever on hub.ideias for all to authenticated
  using (hub.pode(array['admin', 'estrategista', 'criador'])) with check (hub.pode(array['admin', 'estrategista', 'criador']));
create policy briefings_escrever on hub.briefings for all to authenticated
  using (hub.pode(array['admin', 'estrategista', 'criador'])) with check (hub.pode(array['admin', 'estrategista', 'criador']));
create policy materiais_escrever on hub.materiais_ia for all to authenticated
  using (hub.pode(array['admin', 'estrategista', 'criador'])) with check (hub.pode(array['admin', 'estrategista', 'criador']));
create policy jobs_criar on hub.jobs for insert to authenticated
  with check (hub.pode(array['admin', 'estrategista', 'criador']) and criado_por = (select auth.uid()));

-- Alertas: membros só marcam como lido.
create policy alertas_marcar_lido on hub.alertas for update to authenticated
  using (hub.papel_atual() is not null) with check (hub.papel_atual() is not null);
