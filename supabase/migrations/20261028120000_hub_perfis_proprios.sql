-- Prefiro Hub · Atualização 4.0: navegar entre os perfis próprios.
-- Tarefas passam a pertencer a um perfil próprio (opcional) e os relatórios podem ser do grupo
-- (todos os perfis) ou de um perfil só. Nada existente é apagado: tarefas antigas ficam "sem perfil"
-- e os relatórios já gerados continuam valendo como relatórios do grupo.

-- ─── 1. Perfil da tarefa ─────────────────────────────────────────────────────
alter table hub.tarefas add column if not exists perfil_id bigint references hub.perfis (id) on delete set null;
create index if not exists tarefas_conta_perfil_idx on hub.tarefas (conta_id, perfil_id) where arquivada_em is null;
create index if not exists tarefas_perfil_idx on hub.tarefas (perfil_id);

-- Só perfis do grupo "próprio" do mesmo ambiente. Checado só quando o perfil muda, para uma tarefa
-- antiga continuar editável se o perfil mudar de grupo depois.
create or replace function hub.perfil_proprio_da_conta(p_perfil bigint, p_conta bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from hub.perfis p where p.id = p_perfil and p.conta_id = p_conta and p.grupo = 'proprio')
$$;
revoke all on function hub.perfil_proprio_da_conta(bigint, bigint) from public, anon, authenticated;
grant execute on function hub.perfil_proprio_da_conta(bigint, bigint) to service_role;

create or replace function hub.tarefas_perfil_valido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.perfil_id is not null
     and (tg_op = 'INSERT' or new.perfil_id is distinct from old.perfil_id)
     and not hub.perfil_proprio_da_conta(new.perfil_id, new.conta_id) then
    raise exception 'O perfil escolhido não é um perfil próprio deste ambiente.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function hub.tarefas_perfil_valido() from public, anon, authenticated;
drop trigger if exists tarefas_perfil_valido on hub.tarefas;
create trigger tarefas_perfil_valido before insert or update of perfil_id on hub.tarefas
  for each row execute function hub.tarefas_perfil_valido();

-- ─── 2. Histórico: troca de perfil ──────────────────────────────────────────
alter table hub.tarefa_eventos drop constraint if exists tarefa_eventos_tipo_check;
alter table hub.tarefa_eventos add constraint tarefa_eventos_tipo_check
  check (tipo in ('criada', 'status', 'concluida', 'reaberta', 'arquivada', 'restaurada', 'responsavel', 'renomeada', 'perfil'));

create or replace function hub.tarefas_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  nome text := coalesce((select m.nome from hub.membros m where m.user_id = (select auth.uid())), 'Sistema');
begin
  if tg_op = 'INSERT' then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, para, autor, autor_nome)
    values (new.id, new.conta_id, 'criada', new.status, quem, nome);
    if new.concluida_em is not null then
      insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, autor, autor_nome) values (new.id, new.conta_id, 'concluida', quem, nome);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, 'status', old.status, new.status, quem, nome);
  end if;
  if old.concluida_em is null and new.concluida_em is not null then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, autor, autor_nome) values (new.id, new.conta_id, 'concluida', quem, nome);
  elsif old.concluida_em is not null and new.concluida_em is null then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, autor, autor_nome) values (new.id, new.conta_id, 'reaberta', quem, nome);
  end if;
  if old.arquivada_em is null and new.arquivada_em is not null then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, para, autor, autor_nome)
    values (new.id, new.conta_id, 'arquivada', case when new.arquivada_auto then 'automatico' else 'manual' end, quem, nome);
  elsif old.arquivada_em is not null and new.arquivada_em is null then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, autor, autor_nome) values (new.id, new.conta_id, 'restaurada', quem, nome);
  end if;
  if new.responsavel is distinct from old.responsavel then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, 'responsavel', old.responsavel::text, new.responsavel::text, quem, nome);
  end if;
  if new.titulo is distinct from old.titulo then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, 'renomeada', old.titulo, new.titulo, quem, nome);
  end if;
  -- Guarda o @ do perfil (fica legível mesmo se o perfil for removido depois).
  if new.perfil_id is distinct from old.perfil_id then
    insert into hub.tarefa_eventos (tarefa_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, 'perfil',
            (select p.handle from hub.perfis p where p.id = old.perfil_id),
            (select p.handle from hub.perfis p where p.id = new.perfil_id), quem, nome);
  end if;
  return new;
end;
$$;
revoke all on function hub.tarefas_historico() from public, anon, authenticated;

-- ─── 3. Relatórios por perfil ────────────────────────────────────────────────
-- perfil_handle nulo = relatório do grupo (todos os perfis). O @ fica gravado para o relatório
-- continuar identificado mesmo se o perfil sair do ambiente.
alter table hub.relatorios
  add column if not exists perfil_id     bigint references hub.perfis (id) on delete set null,
  add column if not exists perfil_handle text;
create index if not exists relatorios_perfil_idx on hub.relatorios (perfil_id);
drop index if exists hub.relatorios_semanal_unico;
create unique index relatorios_semanal_unico on hub.relatorios (conta_id, periodo_fim, coalesce(perfil_handle, '')) where tipo = 'semanal';

drop function if exists hub.montar_relatorio_periodo(bigint, timestamptz, timestamptz, text, uuid);
create or replace function hub.montar_relatorio_periodo(p_conta bigint, p_ini timestamptz, p_fim timestamptz, p_tipo text, p_autor uuid, p_perfil bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  fuso    text := coalesce((select c.fuso from hub.contas c where c.id = p_conta), 'America/Sao_Paulo');
  d_ini   date := (p_ini at time zone fuso)::date;
  d_fim   date := ((p_fim - interval '1 second') at time zone fuso)::date;
  hoje    date := hub.hoje_conta(p_conta);
  v_handle text;
  v_dados jsonb;
  v_id    bigint;
begin
  if p_perfil is not null then
    select p.handle into v_handle from hub.perfis p where p.id = p_perfil and p.conta_id = p_conta;
    if v_handle is null then
      raise exception 'Perfil não encontrado neste ambiente.' using errcode = '22023';
    end if;
  end if;

  with
  tf as (select * from hub.tarefas t where t.conta_id = p_conta and (p_perfil is null or t.perfil_id = p_perfil)),
  ev as (
    select e.* from hub.tarefa_eventos e
    where e.conta_id = p_conta and e.criado_em >= p_ini and e.criado_em < p_fim
      and (p_perfil is null or e.tarefa_id in (select tf.id from tf))
  ),
  membros as (select m.user_id, m.nome from hub.membros m where m.conta_id = p_conta and m.ativo),
  resp as (
    select m.user_id::text as id, m.nome,
      (select count(*) from tf where tf.responsavel = m.user_id and tf.criado_em >= p_ini and tf.criado_em < p_fim) as criadas,
      (select count(*) from ev join tf on tf.id = ev.tarefa_id where ev.tipo = 'concluida' and tf.responsavel = m.user_id) as concluidas,
      (select count(*) from ev where ev.tipo = 'status' and ev.autor = m.user_id) as movimentacoes,
      (select count(*) from ev where ev.autor = m.user_id) as acoes,
      (select count(*) from tf where tf.responsavel = m.user_id and tf.arquivada_em is null and tf.concluida_em is null) as pendentes,
      (select count(*) from tf where tf.responsavel = m.user_id and tf.arquivada_em is null and tf.concluida_em is null and tf.vencimento < hoje) as atrasadas
    from membros m
    union all
    select null, 'Sem responsável',
      (select count(*) from tf where tf.responsavel is null and tf.criado_em >= p_ini and tf.criado_em < p_fim),
      (select count(*) from ev join tf on tf.id = ev.tarefa_id where ev.tipo = 'concluida' and tf.responsavel is null),
      0, 0,
      (select count(*) from tf where tf.responsavel is null and tf.arquivada_em is null and tf.concluida_em is null),
      (select count(*) from tf where tf.responsavel is null and tf.arquivada_em is null and tf.concluida_em is null and tf.vencimento < hoje)
  ),
  -- Produção quebrada por perfil próprio (só no relatório do grupo).
  prod_perfil as (
    select x.id, x.handle,
      (select count(*) from tf where tf.perfil_id is not distinct from x.id and tf.criado_em >= p_ini and tf.criado_em < p_fim) as criadas,
      (select count(*) from ev join tf on tf.id = ev.tarefa_id where ev.tipo = 'concluida' and tf.perfil_id is not distinct from x.id) as concluidas,
      (select count(*) from ev join tf on tf.id = ev.tarefa_id where ev.tipo = 'status' and ev.para = 'publicado' and tf.perfil_id is not distinct from x.id) as publicadas,
      (select count(*) from tf where tf.perfil_id is not distinct from x.id and tf.arquivada_em is null and tf.concluida_em is null) as pendentes,
      (select count(*) from tf where tf.perfil_id is not distinct from x.id and tf.arquivada_em is null and tf.concluida_em is null and tf.vencimento < hoje) as atrasadas
    from (
      select p.id, p.handle from hub.perfis p where p.conta_id = p_conta and p.grupo = 'proprio' and p.ativo
      union all
      select null::bigint, null::text
    ) x
    where p_perfil is null
  ),
  pf as (select p.id, p.handle, p.nome, p.grupo from hub.perfis p where p.ativo and p.conta_id = p_conta and (p_perfil is null or p.id = p_perfil)),
  leit as (
    select distinct on (m.post_id) m.post_id, m.likes, m.comentarios, m.views, m.salvamentos, m.compartilhamentos, m.alcance
    from hub.post_metricas m
    join hub.posts po on po.id = m.post_id and po.publicado_em >= p_ini and po.publicado_em < p_fim
    join pf on pf.id = po.perfil_id
    order by m.post_id, m.dia desc
  ),
  posts_p as (
    select po.id, po.perfil_id, po.produto, po.tipo, po.legenda, po.permalink, po.thumb_path, po.publicado_em,
           l.likes, l.comentarios, l.views, l.salvamentos, l.compartilhamentos, l.alcance,
           coalesce(l.likes, 0) + coalesce(l.comentarios, 0) as interacoes
    from hub.posts po join pf on pf.id = po.perfil_id left join leit l on l.post_id = po.id
    where po.publicado_em >= p_ini and po.publicado_em < p_fim
  ),
  por_perfil as (
    select pf.id, pf.handle, pf.nome, pf.grupo,
      coalesce(
        (select s.seguidores from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia < d_ini and s.seguidores is not null order by s.dia desc limit 1),
        (select s.seguidores from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia between d_ini and d_fim and s.seguidores is not null order by s.dia limit 1)
      ) as seguidores_inicio,
      (select s.seguidores from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia <= d_fim and s.seguidores is not null order by s.dia desc limit 1) as seguidores_fim,
      (select count(*) from hub.snapshots_diarios s where s.perfil_id = pf.id and s.dia between d_ini and d_fim and s.seguidores is not null) as dias_coletados,
      (select count(*) from posts_p pp where pp.perfil_id = pf.id) as posts,
      (select sum(pp.likes) from posts_p pp where pp.perfil_id = pf.id) as likes,
      (select sum(pp.comentarios) from posts_p pp where pp.perfil_id = pf.id) as comentarios,
      (select sum(pp.views) from posts_p pp where pp.perfil_id = pf.id) as views,
      (select coalesce(sum(pp.interacoes), 0) from posts_p pp where pp.perfil_id = pf.id) as interacoes
    from pf
  ),
  top as (
    select pp.*, pf.handle from posts_p pp join pf on pf.id = pp.perfil_id
    order by pp.interacoes desc, pp.publicado_em desc limit 6
  )
  select jsonb_build_object(
    'formato', 2,
    'escopo', case when p_perfil is null then jsonb_build_object('tipo', 'grupo')
                   else jsonb_build_object('tipo', 'perfil', 'perfil_id', p_perfil, 'handle', v_handle) end,
    'producao', jsonb_build_object(
      'criadas', (select count(*) from tf where tf.criado_em >= p_ini and tf.criado_em < p_fim),
      'concluidas', (select count(*) from ev where ev.tipo = 'concluida'),
      'movimentacoes', (select count(*) from ev where ev.tipo = 'status'),
      'publicadas', (select count(*) from ev where ev.tipo = 'status' and ev.para = 'publicado'),
      'arquivadas', (select count(*) from ev where ev.tipo = 'arquivada'),
      'atrasadas_agora', (select count(*) from tf where tf.arquivada_em is null and tf.concluida_em is null and tf.vencimento < hoje),
      'pendentes_agora', (select count(*) from tf where tf.arquivada_em is null and tf.concluida_em is null),
      'movimentos_por_etapa', coalesce((select jsonb_object_agg(x.para, x.n) from (select ev.para, count(*) n from ev where ev.tipo = 'status' group by ev.para) x), '{}'),
      'etapas_agora', coalesce((select jsonb_object_agg(x.status, x.n) from (select tf.status, count(*) n from tf where tf.arquivada_em is null group by tf.status) x), '{}'),
      'por_responsavel', coalesce((select jsonb_agg(to_jsonb(r) order by r.concluidas desc, r.nome) from resp r), '[]'),
      'por_perfil', coalesce((select jsonb_agg(to_jsonb(x) order by x.handle nulls last) from prod_perfil x), '[]')
    ),
    'instagram', jsonb_build_object(
      'perfis', coalesce((select jsonb_agg(to_jsonb(pp) order by pp.seguidores_fim desc nulls last) from por_perfil pp), '[]'),
      'top_posts', coalesce((select jsonb_agg(jsonb_build_object(
          'id', t.id, 'handle', t.handle, 'produto', t.produto, 'tipo', t.tipo,
          'legenda', left(t.legenda, 220), 'permalink', t.permalink, 'thumb_path', t.thumb_path,
          'publicado_em', t.publicado_em, 'likes', t.likes, 'comentarios', t.comentarios, 'views', t.views,
          'interacoes', t.interacoes) order by t.interacoes desc, t.publicado_em desc) from top t), '[]'),
      'indisponiveis', to_jsonb(array_remove(array[
        case when not exists (select 1 from posts_p where alcance is not null) then 'alcance' end,
        case when not exists (select 1 from posts_p where compartilhamentos is not null) then 'compartilhamentos' end,
        case when not exists (select 1 from posts_p where salvamentos is not null) then 'salvamentos' end
      ], null))
    )
  ) into v_dados;

  insert into hub.relatorios (conta_id, tipo, semana_inicio, semana_fim, periodo_inicio, periodo_fim, parcial, dados, gerado_em, gerado_por, perfil_id, perfil_handle)
  values (p_conta, p_tipo, d_ini, d_fim, p_ini, p_fim, p_fim > now(), v_dados, now(), p_autor, p_perfil, v_handle)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function hub.montar_relatorio_periodo(bigint, timestamptz, timestamptz, text, uuid, bigint) from public, anon, authenticated;
grant execute on function hub.montar_relatorio_periodo(bigint, timestamptz, timestamptz, text, uuid, bigint) to service_role;

-- Semanal de sexta: o do grupo e um para cada perfil próprio ativo, todos com o mesmo período.
create or replace function hub.gerar_relatorios_semanais()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  p record;
  v_fim timestamptz;
  v_ini timestamptz;
  agora_local timestamp;
  n integer := 0;
begin
  for c in select id, fuso from hub.contas loop
    agora_local := now() at time zone c.fuso;
    continue when extract(isodow from agora_local) <> 5 or extract(hour from agora_local) < 6;
    v_fim := (date_trunc('day', agora_local) + interval '6 hours') at time zone c.fuso;
    -- Começa no fechamento do semanal anterior do grupo (sem lacuna e sem sobreposição).
    v_ini := coalesce(
      (select max(r.periodo_fim) from hub.relatorios r
        where r.conta_id = c.id and r.tipo = 'semanal' and r.perfil_handle is null and r.periodo_fim < v_fim and r.dados ? 'formato'),
      v_fim - interval '7 days');

    if not exists (select 1 from hub.relatorios r where r.conta_id = c.id and r.tipo = 'semanal' and r.periodo_fim = v_fim and r.perfil_handle is null) then
      perform hub.montar_relatorio_periodo(c.id, v_ini, v_fim, 'semanal', null, null);
      insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
      values (c.id, null, 'relatorio_semanal',
              format('Relatórios semanais de %s a %s prontos.', to_char(v_ini at time zone c.fuso, 'DD/MM'), to_char(v_fim at time zone c.fuso, 'DD/MM')),
              'sexta:' || (v_fim at time zone c.fuso)::date, 'info', '/progresso');
      n := n + 1;
    end if;

    for p in select pe.id, pe.handle from hub.perfis pe where pe.conta_id = c.id and pe.grupo = 'proprio' and pe.ativo loop
      continue when exists (select 1 from hub.relatorios r where r.conta_id = c.id and r.tipo = 'semanal' and r.periodo_fim = v_fim and r.perfil_handle = p.handle);
      perform hub.montar_relatorio_periodo(c.id, v_ini, v_fim, 'semanal', null, p.id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;
revoke all on function hub.gerar_relatorios_semanais() from public, anon, authenticated;
grant execute on function hub.gerar_relatorios_semanais() to service_role;

-- Relatório por período: do grupo (p_perfil nulo) ou de um perfil próprio.
drop function if exists hub.gerar_relatorio_periodo(date, date);
create or replace function hub.gerar_relatorio_periodo(p_inicio date, p_fim date, p_perfil bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  conta bigint := hub.conta_atual();
  fuso text;
begin
  if conta is null or not hub.pode(array['admin', 'estrategista', 'criador']) then
    raise exception 'Seu papel não permite gerar relatórios.' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio then
    raise exception 'A data final precisa ser igual ou depois da inicial.' using errcode = '22023';
  end if;
  if p_fim - p_inicio > 366 then
    raise exception 'Escolha um período de até um ano.' using errcode = '22023';
  end if;
  if p_perfil is not null and not hub.perfil_proprio_da_conta(p_perfil, conta) then
    raise exception 'Escolha um perfil próprio deste ambiente.' using errcode = '22023';
  end if;
  fuso := (select c.fuso from hub.contas c where c.id = conta);
  return hub.montar_relatorio_periodo(conta,
    p_inicio::timestamp at time zone fuso,
    least((p_fim + 1)::timestamp at time zone fuso, clock_timestamp()),
    'personalizado', (select auth.uid()), p_perfil);
end;
$$;
revoke all on function hub.gerar_relatorio_periodo(date, date, bigint) from public, anon;
grant execute on function hub.gerar_relatorio_periodo(date, date, bigint) to authenticated, service_role;
