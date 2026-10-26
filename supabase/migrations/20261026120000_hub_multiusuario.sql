-- Prefiro Hub · Multiusuário com ambientes isolados.
-- Cada usuário pertence a uma conta (ambiente). Todo dado pertence a uma conta, direta ou indiretamente
-- (pelo perfil monitorado). As regras de acesso (RLS) filtram pela conta de quem está logado, então o
-- isolamento vale no banco e em qualquer API, não só na tela. Os dados atuais ficam na conta da Prefiro.

-- ─── 1. Contas ───────────────────────────────────────────────────────────────
create table hub.contas (
  id        bigint generated always as identity primary key,
  nome      text not null check (length(nome) between 1 and 120),
  criada_em timestamptz not null default now()
);
insert into hub.contas (nome) values ('Prefiro Consórcio');

-- ─── 2. Membros: conta, super admin, status e troca de senha ────────────────
alter table hub.membros
  add column conta_id          bigint references hub.contas (id) on delete cascade,
  add column super_admin       boolean not null default false,
  add column ativo             boolean not null default true,
  add column deve_trocar_senha boolean not null default false;

update hub.membros set conta_id = (select min(id) from hub.contas);
-- A conta administradora principal é o admin que já existia (a Prefiro).
update hub.membros set super_admin = true where papel = 'admin';
alter table hub.membros alter column conta_id set not null;
create index membros_conta_idx on hub.membros (conta_id);

-- ─── 3. Funções de acesso ────────────────────────────────────────────────────
-- Papel do usuário logado; null para quem não é membro ou está desativado.
create or replace function hub.papel_atual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel from hub.membros m where m.user_id = (select auth.uid()) and m.ativo
$$;

-- Conta (ambiente) do usuário logado; null para quem não é membro ou está desativado.
create or replace function hub.conta_atual()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select m.conta_id from hub.membros m where m.user_id = (select auth.uid()) and m.ativo
$$;

create or replace function hub.super_admin_atual()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select m.super_admin from hub.membros m where m.user_id = (select auth.uid()) and m.ativo), false)
$$;

-- O próprio usuário confirma que trocou a senha provisória.
create or replace function hub.confirmar_troca_senha()
returns void
language sql
security definer
set search_path = ''
as $$
  update hub.membros set deve_trocar_senha = false where user_id = (select auth.uid())
$$;

revoke all on function hub.conta_atual(), hub.super_admin_atual(), hub.confirmar_troca_senha() from public, anon;
grant execute on function hub.conta_atual(), hub.super_admin_atual(), hub.confirmar_troca_senha() to authenticated, service_role;

-- ─── 4. Perfis pertencem a uma conta; o mesmo @ pode existir em contas diferentes ─
alter table hub.perfis add column conta_id bigint references hub.contas (id) on delete cascade;
update hub.perfis set conta_id = (select min(id) from hub.contas);
alter table hub.perfis alter column conta_id set not null;
alter table hub.perfis alter column conta_id set default hub.conta_atual();
alter table hub.perfis drop constraint perfis_handle_key;
alter table hub.perfis add constraint perfis_conta_handle_key unique (conta_id, handle);

-- ─── 5. Posts: o id passa a ser "perfil_media", para dois perfis iguais em contas diferentes não colidirem ─
alter table hub.posts add column media_id text;
update hub.posts set media_id = id;

alter table hub.post_metricas drop constraint post_metricas_post_id_fkey;
alter table hub.post_metricas add constraint post_metricas_post_id_fkey
  foreign key (post_id) references hub.posts (id) on delete cascade on update cascade;
alter table hub.ideias drop constraint ideias_post_id_fkey;
alter table hub.ideias add constraint ideias_post_id_fkey
  foreign key (post_id) references hub.posts (id) on delete set null on update cascade;

update hub.posts set id = perfil_id || '_' || media_id;
alter table hub.posts alter column media_id set not null;
alter table hub.posts add constraint posts_perfil_media_key unique (perfil_id, media_id);

-- ─── 6. Alertas, relatórios e coletas por conta ──────────────────────────────
alter table hub.alertas add column conta_id bigint references hub.contas (id) on delete cascade;
update hub.alertas a
  set conta_id = coalesce((select p.conta_id from hub.perfis p where p.id = a.perfil_id), (select min(id) from hub.contas));
alter table hub.alertas alter column conta_id set not null;
create index alertas_conta_criado_idx on hub.alertas (conta_id, criado_em desc);

alter table hub.relatorios add column conta_id bigint references hub.contas (id) on delete cascade;
update hub.relatorios set conta_id = (select min(id) from hub.contas);
alter table hub.relatorios alter column conta_id set not null;
alter table hub.relatorios drop constraint relatorios_semana_inicio_key;
alter table hub.relatorios add constraint relatorios_conta_semana_key unique (conta_id, semana_inicio);

-- Coleta do cron é global (conta nula); a manual registra a conta de quem disparou.
alter table hub.coletas add column conta_id bigint references hub.contas (id) on delete set null;
create index coletas_conta_idx on hub.coletas (conta_id);

-- ─── 7. Regras de acesso (RLS) refeitas por conta ────────────────────────────
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'hub' loop
    execute format('drop policy %I on hub.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table hub.contas enable row level security;
grant select on hub.contas to authenticated;
grant all on hub.contas to service_role;

create policy contas_ler on hub.contas for select to authenticated
  using (id = (select hub.conta_atual()));

-- Membros: cada um vê a si mesmo e a própria conta. Cadastro só pela função de administração.
create policy membros_ler on hub.membros for select to authenticated
  using (user_id = (select auth.uid()) or conta_id = (select hub.conta_atual()));

-- Perfis: só os da própria conta.
create policy perfis_ler on hub.perfis for select to authenticated
  using (conta_id = (select hub.conta_atual()));
create policy perfis_inserir on hub.perfis for insert to authenticated
  with check (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));
create policy perfis_alterar on hub.perfis for update to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']))
  with check (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));
create policy perfis_excluir on hub.perfis for delete to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));

-- Dados coletados: só leitura, e só dos perfis da própria conta.
create policy snapshots_ler on hub.snapshots_diarios for select to authenticated
  using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual())));
create policy posts_ler on hub.posts for select to authenticated
  using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual())));
create policy post_metricas_ler on hub.post_metricas for select to authenticated
  using (post_id in (select p.id from hub.posts p join hub.perfis f on f.id = p.perfil_id
                     where f.conta_id = (select hub.conta_atual())));

-- Alertas: ler e marcar como lido, só da própria conta.
create policy alertas_ler on hub.alertas for select to authenticated
  using (conta_id = (select hub.conta_atual()));
create policy alertas_marcar_lido on hub.alertas for update to authenticated
  using (conta_id = (select hub.conta_atual()))
  with check (conta_id = (select hub.conta_atual()));

-- Planejamento: ideias e briefings da própria conta.
create policy ideias_ler on hub.ideias for select to authenticated
  using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual())));
create policy ideias_inserir on hub.ideias for insert to authenticated
  with check (
    perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
    and (post_id is null or post_id in (select p.id from hub.posts p where p.perfil_id = ideias.perfil_id))
    and hub.pode(array['admin', 'estrategista', 'criador']));
create policy ideias_alterar on hub.ideias for update to authenticated
  using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
         and hub.pode(array['admin', 'estrategista', 'criador']))
  with check (
    perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
    and (post_id is null or post_id in (select p.id from hub.posts p where p.perfil_id = ideias.perfil_id))
    and hub.pode(array['admin', 'estrategista', 'criador']));
create policy ideias_excluir on hub.ideias for delete to authenticated
  using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
         and hub.pode(array['admin', 'estrategista', 'criador']));

create policy briefings_ler on hub.briefings for select to authenticated
  using (ideia_id in (select i.id from hub.ideias i join hub.perfis f on f.id = i.perfil_id
                      where f.conta_id = (select hub.conta_atual())));
create policy briefings_inserir on hub.briefings for insert to authenticated
  with check (ideia_id in (select i.id from hub.ideias i join hub.perfis f on f.id = i.perfil_id
                           where f.conta_id = (select hub.conta_atual()))
              and hub.pode(array['admin', 'estrategista', 'criador']));
create policy briefings_alterar on hub.briefings for update to authenticated
  using (ideia_id in (select i.id from hub.ideias i join hub.perfis f on f.id = i.perfil_id
                      where f.conta_id = (select hub.conta_atual()))
         and hub.pode(array['admin', 'estrategista', 'criador']))
  with check (ideia_id in (select i.id from hub.ideias i join hub.perfis f on f.id = i.perfil_id
                           where f.conta_id = (select hub.conta_atual()))
              and hub.pode(array['admin', 'estrategista', 'criador']));
create policy briefings_excluir on hub.briefings for delete to authenticated
  using (ideia_id in (select i.id from hub.ideias i join hub.perfis f on f.id = i.perfil_id
                      where f.conta_id = (select hub.conta_atual()))
         and hub.pode(array['admin', 'estrategista', 'criador']));

-- Metas e posicionamento: perfis da própria conta, escrita por admin e estrategista.
do $$
declare t text;
begin
  foreach t in array array['metas', 'posicionamento'] loop
    execute format($f$
      create policy %1$s_ler on hub.%1$I for select to authenticated
        using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual())));
      create policy %1$s_inserir on hub.%1$I for insert to authenticated
        with check (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
                    and hub.pode(array['admin', 'estrategista']));
      create policy %1$s_alterar on hub.%1$I for update to authenticated
        using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
               and hub.pode(array['admin', 'estrategista']))
        with check (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
                    and hub.pode(array['admin', 'estrategista']));
      create policy %1$s_excluir on hub.%1$I for delete to authenticated
        using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual()))
               and hub.pode(array['admin', 'estrategista']));
    $f$, t);
  end loop;
end $$;

-- Materiais de IA antigos: preservados, visíveis só para a própria conta (o Estúdio saiu do app).
create policy materiais_ler on hub.materiais_ia for select to authenticated
  using (perfil_id in (select f.id from hub.perfis f where f.conta_id = (select hub.conta_atual())));

create policy jobs_ler on hub.jobs for select to authenticated
  using (criado_por = (select auth.uid()));

create policy relatorios_ler on hub.relatorios for select to authenticated
  using (conta_id = (select hub.conta_atual()));

create policy coletas_ler on hub.coletas for select to authenticated
  using (conta_id = (select hub.conta_atual()));

-- Configurações globais: membros leem; só a conta administradora principal altera.
create policy config_ler on hub.config for select to authenticated
  using ((select hub.papel_atual()) is not null);
create policy config_alterar on hub.config for update to authenticated
  using ((select hub.super_admin_atual())) with check ((select hub.super_admin_atual()));

-- ─── 8. Alertas: mesmas regras, agora gravando a conta de cada alerta ───────
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
  insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
  select p.conta_id, s.perfil_id, 'queda_seguidores',
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
  insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
  select pf.conta_id, r.perfil_id, 'post_destaque',
         format('Post de @%s chegou a %s interações, %s vezes a média recente.', pf.handle, r.inter,
                replace(round(r.inter / r.media, 1)::text, '.', ',')),
         r.post_id, 'info', r.permalink
  from ref r join hub.perfis pf on pf.id = r.perfil_id and pf.ativo
  where r.media > 0 and r.inter >= 3 * r.media and r.inter >= 30
  on conflict (perfil_id, tipo, chave) do nothing;
  get diagnostics n = row_count; total := total + n;

  -- 3. Meta de seguidores fora do ritmo (no máximo um alerta por meta por semana).
  insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
  select pf.conta_id, m.perfil_id, 'meta_em_risco',
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
  insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
  select p.conta_id, p.id, 'coleta_erro', format('A coleta de @%s falhou: %s', p.handle, p.ultimo_erro),
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

-- ─── 9. Relatório semanal por conta ──────────────────────────────────────────
-- Monta o relatório de uma conta. Uso interno: chamado pela função pública abaixo.
create or replace function hub.montar_relatorio(p_conta bigint, p_inicio date default null)
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
  ini := date_trunc('week', coalesce(p_inicio, hoje - 7))::date;
  if ini > hoje then
    raise exception 'A semana ainda não começou.' using errcode = '22023';
  end if;
  fim := ini + 6;
  ts_ini := ini::timestamp at time zone 'America/Sao_Paulo';
  ts_fim := (fim + 1)::timestamp at time zone 'America/Sao_Paulo';

  with
  pf as (
    select p.id, p.handle, p.nome, p.grupo from hub.perfis p where p.ativo and p.conta_id = p_conta
  ),
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
    where a.conta_id = p_conta and a.criado_em >= ts_ini and a.criado_em < ts_fim and a.tipo <> 'relatorio_semanal'
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

  insert into hub.relatorios (conta_id, semana_inicio, semana_fim, parcial, dados, gerado_em, gerado_por)
  values (p_conta, ini, fim, fim >= hoje, v_dados, now(), (select auth.uid()))
  on conflict (conta_id, semana_inicio) do update
    set semana_fim = excluded.semana_fim, parcial = excluded.parcial, dados = excluded.dados,
        gerado_em = excluded.gerado_em, gerado_por = excluded.gerado_por
  returning id into v_id;

  -- Avisa a conta quando a semana fechada fica pronta (uma vez por semana).
  if fim < hoje and not exists (
    select 1 from hub.alertas a where a.conta_id = p_conta and a.tipo = 'relatorio_semanal' and a.chave = ini::text
  ) then
    insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
    values (p_conta, null, 'relatorio_semanal',
            format('Relatório da semana de %s a %s pronto.', to_char(ini, 'DD/MM'), to_char(fim, 'DD/MM')),
            ini::text, 'info', '/progresso?semana=' || ini::text);
  end if;

  return v_id;
end;
$$;

revoke all on function hub.montar_relatorio(bigint, date) from public, anon, authenticated;
grant execute on function hub.montar_relatorio(bigint, date) to service_role;

-- Pelo app: gera o relatório da conta de quem chama (admin ou estrategista).
-- Pelo cron (sem usuário): gera o de todas as contas.
create or replace function hub.gerar_relatorio_semanal(p_inicio date default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  c record;
begin
  if (select auth.uid()) is not null then
    if not hub.pode(array['admin', 'estrategista']) or hub.conta_atual() is null then
      raise exception 'Só admin ou estrategista pode gerar o relatório.' using errcode = '42501';
    end if;
    return hub.montar_relatorio(hub.conta_atual(), p_inicio);
  end if;
  for c in select id from hub.contas order by id loop
    v_id := hub.montar_relatorio(c.id, p_inicio);
  end loop;
  return v_id;
end;
$$;

revoke all on function hub.gerar_relatorio_semanal(date) from public, anon;
grant execute on function hub.gerar_relatorio_semanal(date) to authenticated, service_role;
