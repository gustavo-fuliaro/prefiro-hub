-- Prefiro Hub · configurações gerais do Hub. Primeira chave: o cadeado do Estúdio de IA.
-- Todos os membros leem; só admin altera. A Edge Function gerar-conteudo também respeita a chave.

create table if not exists hub.config (
  chave          text primary key check (chave ~ '^[a-z_]{1,60}$'),
  valor          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references auth.users (id) on delete set null
);

alter table hub.config enable row level security;

drop policy if exists config_ler on hub.config;
create policy config_ler on hub.config for select to authenticated
  using ((select hub.papel_atual()) is not null);

drop policy if exists config_alterar on hub.config;
create policy config_alterar on hub.config for update to authenticated
  using ((select hub.pode(array['admin'])))
  with check ((select hub.pode(array['admin'])));

grant select, update on hub.config to authenticated;
create index if not exists config_atualizado_por_idx on hub.config (atualizado_por);

-- Começa bloqueado: a conta da Anthropic ainda não tem créditos.
insert into hub.config (chave, valor) values ('estudio_liberado', 'false'::jsonb)
on conflict (chave) do nothing;
