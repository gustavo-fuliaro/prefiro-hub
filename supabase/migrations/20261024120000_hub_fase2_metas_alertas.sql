-- Prefiro Hub · Fase 2: metas com ponto de partida e alertas diários sem duplicar.

alter table hub.metas
  add column if not exists base       numeric,
  add column if not exists inicio     date not null default current_date,
  add column if not exists criado_por uuid default auth.uid();
alter table hub.metas drop constraint if exists metas_metrica_chk;
alter table hub.metas add constraint metas_metrica_chk check (metrica in ('seguidores', 'engajamento', 'posts_mes'));

alter table hub.alertas
  add column if not exists chave      text,
  add column if not exists severidade text not null default 'info',
  add column if not exists link       text;
alter table hub.alertas drop constraint if exists alertas_severidade_chk;
alter table hub.alertas add constraint alertas_severidade_chk check (severidade in ('info', 'atencao', 'critico'));
create unique index if not exists alertas_unico on hub.alertas (perfil_id, tipo, chave);
create index if not exists alertas_nao_lidos_idx on hub.alertas (criado_em desc) where not lido;

-- Gera os alertas do dia. Roda depois da coleta (cron) e não repete o mesmo alerta (chave única).
create or replace function hub.gerar_alertas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer := 0;
  n integer;
begin
  -- 1. Queda de seguidores entre as duas últimas leituras.
  insert into hub.alertas (perfil_id, tipo, mensagem, chave, severidade, link)
  select s.perfil_id, 'queda_seguidores',
         format('@%s perdeu %s seguidores entre %s e %s.', p.handle, ant.seguidores - s.seguidores,
                to_char(ant.dia, 'DD/MM'), to_char(s.dia, 'DD/MM')),
         s.dia::text,
         case when ant.seguidores - s.seguidores >= greatest(50, ant.seguidores * 0.01) then 'critico' else 'atencao' end,
         '/perfis/' || p.handle
  from hub.snapshots_diarios s
  join hub.perfis p on p.id = s.perfil_id and p.ativo
  join lateral (
    select a.dia, a.seguidores from hub.snapshots_diarios a
    where a.perfil_id = s.perfil_id and a.dia < s.dia and a.seguidores is not null
    order by a.dia desc limit 1
  ) ant on true
  where s.seguidores is not null
    and s.dia = (select max(x.dia) from hub.snapshots_diarios x where x.perfil_id = s.perfil_id and x.seguidores is not null)
    and ant.seguidores - s.seguidores >= greatest(10, ant.seguidores * 0.003)
  on conflict (perfil_id, tipo, chave) do nothing;
  get diagnostics n = row_count; total := total + n;

  -- 2. Post dos últimos 7 dias com 3x ou mais as interações médias dos 12 posts anteriores.
  with ult as (
    select p.id as post_id, p.perfil_id, p.publicado_em, p.permalink,
           (select coalesce(m.likes, 0) + coalesce(m.comentarios, 0)
              from hub.post_metricas m where m.post_id = p.id order by m.dia desc limit 1) as inter
    from hub.posts p
  ), ref as (
    select u.*,
           (select avg(o.inter) from (
              select o2.inter from ult o2
              where o2.perfil_id = u.perfil_id and o2.publicado_em < u.publicado_em and o2.inter is not null
              order by o2.publicado_em desc limit 12) o) as media
    from ult u
    where u.publicado_em >= now() - interval '7 days' and u.inter is not null
  )
  insert into hub.alertas (perfil_id, tipo, mensagem, chave, severidade, link)
  select r.perfil_id, 'post_destaque',
         format('Post de @%s chegou a %s interações, %s vezes a média recente.', pf.handle, r.inter,
                replace(round(r.inter / r.media, 1)::text, '.', ',')),
         r.post_id, 'info', r.permalink
  from ref r join hub.perfis pf on pf.id = r.perfil_id and pf.ativo
  where r.media > 0 and r.inter >= 3 * r.media and r.inter >= 30
  on conflict (perfil_id, tipo, chave) do nothing;
  get diagnostics n = row_count; total := total + n;

  -- 3. Meta de seguidores fora do ritmo (no máximo um alerta por meta por semana).
  insert into hub.alertas (perfil_id, tipo, mensagem, chave, severidade, link)
  select m.perfil_id, 'meta_em_risco',
         format('No ritmo dos últimos 30 dias, @%s não chega a %s seguidores até %s.', pf.handle,
                to_char(m.alvo, 'FM999G999G999'), to_char(m.prazo, 'DD/MM/YYYY')),
         m.id || '-' || to_char(current_date, 'IYYY-IW'), 'atencao', '/metas'
  from hub.metas m
  join hub.perfis pf on pf.id = m.perfil_id and pf.ativo
  join lateral (
    select a.dia, a.seguidores from hub.snapshots_diarios a
    where a.perfil_id = m.perfil_id and a.seguidores is not null order by a.dia desc limit 1
  ) atual on true
  join lateral (
    select b.dia, b.seguidores from hub.snapshots_diarios b
    where b.perfil_id = m.perfil_id and b.seguidores is not null and b.dia >= atual.dia - 30
    order by b.dia asc limit 1
  ) ini on true
  where m.metrica = 'seguidores' and m.prazo > current_date and atual.seguidores < m.alvo
    and atual.dia - ini.dia >= 7
    and atual.seguidores + (atual.seguidores - ini.seguidores)::numeric / (atual.dia - ini.dia) * (m.prazo - atual.dia) < m.alvo
  on conflict (perfil_id, tipo, chave) do nothing;
  get diagnostics n = row_count; total := total + n;

  -- 4. Coleta com erro.
  insert into hub.alertas (perfil_id, tipo, mensagem, chave, severidade, link)
  select p.id, 'coleta_erro', format('A coleta de @%s falhou: %s', p.handle, p.ultimo_erro),
         current_date::text, 'critico', '/perfis/' || p.handle
  from hub.perfis p
  where p.ativo and p.ultimo_erro is not null
  on conflict (perfil_id, tipo, chave) do nothing;
  get diagnostics n = row_count; total := total + n;

  return total;
end;
$$;

revoke all on function hub.gerar_alertas() from public, anon, authenticated;
grant execute on function hub.gerar_alertas() to service_role;
