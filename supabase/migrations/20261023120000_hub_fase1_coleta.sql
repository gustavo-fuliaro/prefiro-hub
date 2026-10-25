-- Prefiro Hub · Fase 1: coleta diária
-- A coleta roda numa Edge Function (service role). Aqui ficam o registro das execuções,
-- o status por perfil, o bucket das imagens e as funções de leitura do cockpit.

-- Status da última coleta e dados de perfil vindos da Meta.
alter table hub.perfis
  add column if not exists bio              text,
  add column if not exists foto_path        text,
  add column if not exists ultima_coleta_em timestamptz,
  add column if not exists ultimo_erro      text;

-- Métricas por post também guardam o tipo de produto (REELS, FEED) para filtros.
alter table hub.posts
  add column if not exists produto text;

-- Uma linha por execução da coleta.
create table hub.coletas (
  id           bigint generated always as identity primary key,
  origem       text not null check (origem in ('cron', 'manual')),
  iniciada_em  timestamptz not null default now(),
  terminada_em timestamptz,
  perfis_ok    integer not null default 0,
  perfis_erro  integer not null default 0,
  detalhes     jsonb not null default '[]',
  disparada_por uuid
);
create index coletas_iniciada_idx on hub.coletas (iniciada_em desc);

alter table hub.coletas enable row level security;
grant select on hub.coletas to authenticated;
grant all on hub.coletas to service_role;
create policy coletas_ler on hub.coletas for select to authenticated using (hub.papel_atual() is not null);

-- Resumo para a lista de perfis: último número, variação em 7 e 30 dias.
create or replace view hub.perfis_resumo
with (security_invoker = true) as
with ult as (
  select distinct on (perfil_id) perfil_id, dia, seguidores, total_posts
  from hub.snapshots_diarios
  where seguidores is not null
  order by perfil_id, dia desc
),
base7 as (
  select distinct on (s.perfil_id) s.perfil_id, s.seguidores
  from hub.snapshots_diarios s join ult u on u.perfil_id = s.perfil_id
  where s.seguidores is not null and s.dia <= u.dia - 7
  order by s.perfil_id, s.dia desc
),
base30 as (
  select distinct on (s.perfil_id) s.perfil_id, s.seguidores
  from hub.snapshots_diarios s join ult u on u.perfil_id = s.perfil_id
  where s.seguidores is not null and s.dia <= u.dia - 30
  order by s.perfil_id, s.dia desc
),
eng as (
  -- engajamento médio dos 12 posts mais recentes, na última leitura de cada post
  select p.perfil_id,
         avg(coalesce(m.likes, 0) + coalesce(m.comentarios, 0)) as interacoes_media
  from (
    select id, perfil_id,
           row_number() over (partition by perfil_id order by publicado_em desc) as rn
    from hub.posts
  ) p
  join lateral (
    select likes, comentarios from hub.post_metricas pm
    where pm.post_id = p.id order by pm.dia desc limit 1
  ) m on true
  where p.rn <= 12
  group by p.perfil_id
)
select pf.id, pf.handle, pf.nome, pf.grupo, pf.fonte, pf.ativo, pf.foto_path,
       pf.ultima_coleta_em, pf.ultimo_erro,
       u.dia as ultimo_dia, u.seguidores, u.total_posts,
       u.seguidores - b7.seguidores  as delta_7d,
       u.seguidores - b30.seguidores as delta_30d,
       case when u.seguidores > 0 then round(e.interacoes_media * 100.0 / u.seguidores, 2) end as engajamento_pct
from hub.perfis pf
left join ult    u   on u.perfil_id  = pf.id
left join base7  b7  on b7.perfil_id = pf.id
left join base30 b30 on b30.perfil_id = pf.id
left join eng    e   on e.perfil_id  = pf.id;

grant select on hub.perfis_resumo, hub.market_share_diario to authenticated;

-- Bucket público de imagens (fotos de perfil e capas de posts). São imagens públicas do Instagram;
-- guardamos cópia porque as URLs da Meta expiram. Só o service role escreve.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hub-midia', 'hub-midia', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
