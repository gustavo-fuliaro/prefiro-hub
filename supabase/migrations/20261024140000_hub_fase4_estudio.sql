-- Prefiro Hub · Fase 4: estúdio de IA.

-- A função de geração também lê a chave da Anthropic do Vault.
create or replace function hub.segredo(nome text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = nome
    and nome in ('meta_access_token', 'meta_ig_user_id', 'hub_cron_secret', 'anthropic_api_key')
  limit 1
$$;
revoke all on function hub.segredo(text) from public, anon, authenticated;
grant execute on function hub.segredo(text) to service_role;

alter table hub.materiais_ia
  add column if not exists ideia_id bigint references hub.ideias (id) on delete set null,
  add column if not exists job_id   uuid references hub.jobs (id) on delete set null,
  add column if not exists modelo   text;
alter table hub.materiais_ia drop constraint if exists materiais_tipo_chk;
alter table hub.materiais_ia add constraint materiais_tipo_chk check (tipo in ('ideias', 'roteiro', 'analise'));
create index if not exists materiais_ia_ideia_idx on hub.materiais_ia (ideia_id);
create index if not exists materiais_ia_job_idx on hub.materiais_ia (job_id);
create index if not exists materiais_ia_criado_idx on hub.materiais_ia (perfil_id, criado_em desc);

alter table hub.jobs
  add column if not exists perfil_id    bigint references hub.perfis (id) on delete cascade,
  add column if not exists terminado_em timestamptz;
create index if not exists jobs_perfil_idx on hub.jobs (perfil_id);
create index if not exists jobs_criado_por_idx on hub.jobs (criado_por, criado_em desc);
