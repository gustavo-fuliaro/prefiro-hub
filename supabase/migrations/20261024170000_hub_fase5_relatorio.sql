-- Prefiro Hub · Fase 5: relatório semanal.
-- Uma linha por semana (segunda a domingo, horário de Brasília) com os números brutos em jsonb.
-- Os cálculos derivados (participação, destaques) ficam no app, em src/lib/relatorio.ts.

create table if not exists hub.relatorios (
  id            bigint generated always as identity primary key,
  semana_inicio date not null unique check (extract(isodow from semana_inicio) = 1),
  semana_fim    date not null,
  parcial       boolean not null default false,
  dados         jsonb not null,
  gerado_em     timestamptz not null default now(),
  gerado_por    uuid references auth.users (id) on delete set null
);

alter table hub.relatorios enable row level security;

drop policy if exists relatorios_ler on hub.relatorios;
create policy relatorios_ler on hub.relatorios for select to authenticated
  using ((select hub.papel_atual()) is not null);

grant select on hub.relatorios to authenticated;
create index if not exists relatorios_gerado_por_idx on hub.relatorios (gerado_por);

-- Gera (ou refaz) o relatório da semana que começa em p_inicio.
-- Sem argumento: a última semana completa. Quem chama pelo app precisa ser admin ou estrategista;
-- o cron roda sem usuário (auth.uid() nulo).
create or replace function hub.gerar_relatorio_semanal(p_inicio date default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  ini       date;
  fim       date;
  ts_ini    timestamptz;
  ts_fim    timestamptz;
  v_dados   jsonb;
  v_id      bigint;
begin
  if (select auth.uid()) is not null and not hub.pode(array['admin', 'estrategista']) then
    raise exception 'Só admin ou estrategista pode gerar o relatório.' using errcode = '42501';
  end if;

  ini := date_trunc('week', coalesce(p_inicio, hoje - 7))::date;
  if ini > hoje then
    raise exception 'A semana ainda não começou.' using errcode = '22023';
  end if;
  fim := ini + 6;
  ts_ini := ini::timestamp at time zone 'America/Sao_Paulo';
  ts_fim := (fim + 1)::timestamp at time zone 'America/Sao_Paulo';

  with
  pf as (
    select p.id, p.handle, p.nome, p.grupo from hub.perfis p where p.ativo
  ),
  -- Última leitura de cada post (likes + comentários).
  inter as (
    select distinct on (m.post_id) m.post_id, coalesce(m.likes, 0) as likes, coalesce(m.comentarios, 0) as comentarios
    from hub.post_metricas m
    join hub.posts po on po.id = m.post_id and po.publicado_em >= ts_ini and po.publicado_em < ts_fim
    order by m.post_id, m.dia desc
  ),
  posts_semana as (
    select po.id, po.perfil_id, po.produto, po.tipo, po.legenda, po.permalink, po.thumb_path, po.publicado_em,
           i.likes, i.comentarios, coalesce(i.likes + i.comentarios, 0) as interacoes
    from hub.posts po
    join pf on pf.id = po.perfil_id
    left join inter i on i.post_id = po.id
    where po.publicado_em >= ts_ini and po.publicado_em < ts_fim
  ),
  por_perfil as (
    select pf.id, pf.handle, pf.nome, pf.grupo,
           -- Partida: última leitura antes da semana; se não houver, a primeira dentro dela.
           coalesce(
             (select s.seguidores from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia < ini and s.seguidores is not null order by s.dia desc limit 1),
             (select s.seguidores from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia between ini and fim and s.seguidores is not null order by s.dia limit 1)
           ) as seguidores_inicio,
           (select s.seguidores from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia <= fim and s.seguidores is not null order by s.dia desc limit 1) as seguidores_fim,
           (select count(*) from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia between ini and fim and s.seguidores is not null) as dias_coletados,
           (select count(*) from posts_semana ps where ps.perfil_id = pf.id) as posts,
           (select coalesce(sum(ps.interacoes), 0) from posts_semana ps where ps.perfil_id = pf.id) as interacoes
    from pf
  ),
  top as (
    select ps.*, pf.handle from posts_semana ps join pf on pf.id = ps.perfil_id
    order by ps.interacoes desc, ps.publicado_em desc limit 6
  ),
  metas as (
    select m.id, pf.handle, m.metrica, m.alvo, m.prazo, m.base,
           case m.metrica
             when 'seguidores' then (select pp.seguidores_fim from por_perfil pp where pp.id = m.perfil_id)::numeric
             when 'posts_mes' then (
               select count(*) from hub.posts po where po.perfil_id = m.perfil_id
                 and po.publicado_em >= date_trunc('month', fim)::timestamp at time zone 'America/Sao_Paulo'
                 and po.publicado_em < ts_fim)::numeric
           end as atual
    from hub.metas m join pf on pf.id = m.perfil_id
    where m.prazo >= ini
  ),
  ideias_pub as (
    select i.id, i.titulo, pf.handle, ps.interacoes, ps.permalink
    from hub.ideias i
    join posts_semana ps on ps.id = i.post_id
    join pf on pf.id = i.perfil_id
  ),
  alertas as (
    select a.tipo, count(*) as total from hub.alertas a
    where a.criado_em >= ts_ini and a.criado_em < ts_fim and a.tipo <> 'relatorio_semanal'
    group by a.tipo
  )
  select jsonb_build_object(
    'perfis',  coalesce((select jsonb_agg(to_jsonb(pp) order by pp.seguidores_fim desc nulls last) from por_perfil pp), '[]'),
    'top_posts', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'handle', t.handle, 'produto', t.produto, 'tipo', t.tipo,
        'legenda', left(t.legenda, 220), 'permalink', t.permalink, 'thumb_path', t.thumb_path,
        'publicado_em', t.publicado_em, 'likes', t.likes, 'comentarios', t.comentarios, 'interacoes', t.interacoes)
        order by t.interacoes desc, t.publicado_em desc) from top t), '[]'),
    'metas',   coalesce((select jsonb_agg(to_jsonb(me) order by me.prazo) from metas me), '[]'),
    'ideias_publicadas', coalesce((select jsonb_agg(to_jsonb(ip) order by ip.interacoes desc nulls last) from ideias_pub ip), '[]'),
    'alertas', coalesce((select jsonb_object_agg(al.tipo, al.total) from alertas al), '{}')
  ) into v_dados;

  insert into hub.relatorios (semana_inicio, semana_fim, parcial, dados, gerado_em, gerado_por)
  values (ini, fim, fim >= hoje, v_dados, now(), (select auth.uid()))
  on conflict (semana_inicio) do update
    set semana_fim = excluded.semana_fim, parcial = excluded.parcial, dados = excluded.dados,
        gerado_em = excluded.gerado_em, gerado_por = excluded.gerado_por
  returning id into v_id;

  -- Avisa a equipe quando a semana fechada fica pronta (uma vez por semana).
  if fim < hoje and not exists (select 1 from hub.alertas a where a.tipo = 'relatorio_semanal' and a.chave = ini::text) then
    insert into hub.alertas (perfil_id, tipo, mensagem, chave, severidade, link)
    values (null, 'relatorio_semanal',
            format('Relatório da semana de %s a %s pronto.', to_char(ini, 'DD/MM'), to_char(fim, 'DD/MM')),
            ini::text, 'info', '/progresso?semana=' || ini::text);
  end if;

  return v_id;
end;
$$;

revoke all on function hub.gerar_relatorio_semanal(date) from public, anon;
grant execute on function hub.gerar_relatorio_semanal(date) to authenticated, service_role;
