-- Prefiro Hub · Atualizações 3.0: Planejador de tarefas, comentários, histórico, alertas de atraso,
-- arquivamento automático e relatórios de produção (semanal de sexta e por período).
-- Tudo isolado por conta (ambiente). As tabelas antigas (ideias, briefings) ficam preservadas.

-- ─── 0. Fuso por ambiente (relatórios e atrasos usam a data local do ambiente) ─
alter table hub.contas add column if not exists fuso text not null default 'America/Sao_Paulo';

create or replace function hub.hoje_conta(p_conta bigint)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce((select c.fuso from hub.contas c where c.id = p_conta), 'America/Sao_Paulo'))::date
$$;
revoke all on function hub.hoje_conta(bigint) from public, anon;
grant execute on function hub.hoje_conta(bigint) to authenticated, service_role;

-- ─── 1. Tarefas ──────────────────────────────────────────────────────────────
-- Etapas: roteirizacao → gravacao → edicao → pronto → (agendado | publicado).
-- "agendado" e "publicado" dividem a última coluna; só "publicado" conta como concluído.
create table hub.tarefas (
  id              bigint generated always as identity primary key,
  conta_id        bigint not null default hub.conta_atual() references hub.contas (id) on delete cascade,
  titulo          text not null check (length(btrim(titulo)) between 1 and 200),
  status          text not null default 'roteirizacao'
                  check (status in ('roteirizacao', 'gravacao', 'edicao', 'pronto', 'agendado', 'publicado')),
  responsavel     uuid references hub.membros (user_id) on delete set null,
  vencimento      date,
  link_roteiro    text check (link_roteiro is null or link_roteiro ~* '^https?://\S+$'),
  link_drive      text check (link_drive is null or link_drive ~* '^https?://\S+$'),
  data_publicacao date,
  ordem           double precision not null default extract(epoch from now()),
  concluida_em    timestamptz,
  publicado_em    timestamptz,          -- última vez que a tarefa foi para "publicado"
  arquivada_em    timestamptz,
  arquivada_auto  boolean not null default false,
  restaurada_em   timestamptz,
  criado_em       timestamptz not null default now(),
  criado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid default auth.uid() references auth.users (id) on delete set null
);
create index tarefas_conta_ativas_idx on hub.tarefas (conta_id, status, ordem) where arquivada_em is null;
create index tarefas_conta_publicacao_idx on hub.tarefas (conta_id, data_publicacao) where data_publicacao is not null;
create index tarefas_responsavel_idx on hub.tarefas (responsavel);
create index tarefas_criado_por_idx on hub.tarefas (criado_por);
create index tarefas_atualizado_por_idx on hub.tarefas (atualizado_por);

-- Regras automáticas de status, conclusão e arquivamento.
create or replace function hub.tarefas_regras()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.titulo := btrim(new.titulo);
  new.atualizado_em := now();
  new.atualizado_por := coalesce((select auth.uid()), new.atualizado_por);
  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := coalesce((select auth.uid()), new.criado_por);
  else
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
    new.conta_id := old.conta_id;
  end if;

  -- Ir para "publicado": registra a publicação efetiva e conclui.
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from 'publicado') then
    new.publicado_em := clock_timestamp();
    new.concluida_em := coalesce(new.concluida_em, now());
    new.data_publicacao := coalesce(new.data_publicacao, hub.hoje_conta(new.conta_id));
  end if;

  if tg_op = 'UPDATE' then
    -- Restaurar: volta ao Kanban e só pode ser arquivada de novo por nova ação ou nova publicação.
    if old.arquivada_em is not null and new.arquivada_em is null then
      new.restaurada_em := clock_timestamp();
      new.arquivada_auto := false;
    end if;
    -- Sair de "publicado" reabre a tarefa (a conclusão era a publicação).
    if old.status = 'publicado' and new.status <> 'publicado' and new.concluida_em is not distinct from old.concluida_em then
      new.concluida_em := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger tarefas_regras before insert or update on hub.tarefas
  for each row execute function hub.tarefas_regras();

-- ─── 2. Comentários ──────────────────────────────────────────────────────────
create table hub.tarefa_comentarios (
  id         bigint generated always as identity primary key,
  tarefa_id  bigint not null references hub.tarefas (id) on delete cascade,
  autor      uuid default auth.uid() references auth.users (id) on delete set null,
  autor_nome text not null default '',
  texto      text not null check (length(btrim(texto)) between 1 and 4000),
  criado_em  timestamptz not null default now()
);
create index tarefa_comentarios_tarefa_idx on hub.tarefa_comentarios (tarefa_id, criado_em);
create index tarefa_comentarios_autor_idx on hub.tarefa_comentarios (autor);

-- Nome do autor gravado no comentário (fica legível mesmo se a pessoa sair do ambiente).
create or replace function hub.comentario_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.autor := (select auth.uid());
  new.autor_nome := coalesce((select m.nome from hub.membros m where m.user_id = new.autor), 'Usuário');
  new.texto := btrim(new.texto);
  new.criado_em := now();
  return new;
end;
$$;
create trigger tarefa_comentarios_autor before insert on hub.tarefa_comentarios
  for each row execute function hub.comentario_autor();

-- ─── 3. Histórico de alterações (base dos relatórios de produtividade) ───────
create table hub.tarefa_eventos (
  id         bigint generated always as identity primary key,
  tarefa_id  bigint not null references hub.tarefas (id) on delete cascade,
  conta_id   bigint not null references hub.contas (id) on delete cascade,
  tipo       text not null check (tipo in ('criada', 'status', 'concluida', 'reaberta', 'arquivada', 'restaurada', 'responsavel', 'renomeada')),
  de         text,
  para       text,
  autor      uuid references auth.users (id) on delete set null,
  autor_nome text not null default 'Sistema',
  criado_em  timestamptz not null default now()
);
create index tarefa_eventos_tarefa_idx on hub.tarefa_eventos (tarefa_id, criado_em);
create index tarefa_eventos_conta_idx on hub.tarefa_eventos (conta_id, criado_em);
create index tarefa_eventos_autor_idx on hub.tarefa_eventos (autor);

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
  return new;
end;
$$;

create trigger tarefas_historico after insert or update on hub.tarefas
  for each row execute function hub.tarefas_historico();

-- ─── 4. Acesso (RLS) ─────────────────────────────────────────────────────────
alter table hub.tarefas enable row level security;
alter table hub.tarefa_comentarios enable row level security;
alter table hub.tarefa_eventos enable row level security;
grant select, insert, update, delete on hub.tarefas, hub.tarefa_comentarios to authenticated;
grant select on hub.tarefa_eventos to authenticated;
grant all on hub.tarefas, hub.tarefa_comentarios, hub.tarefa_eventos to service_role;

-- Ler: qualquer membro ativo do ambiente (inclusive tarefas arquivadas).
create policy tarefas_ler on hub.tarefas for select to authenticated
  using (conta_id = (select hub.conta_atual()));
-- Criar e editar: admin, estrategista e criador. Responsável só pode ser alguém ativo do mesmo ambiente.
create policy tarefas_inserir on hub.tarefas for insert to authenticated
  with check (
    conta_id = (select hub.conta_atual())
    and hub.pode(array['admin', 'estrategista', 'criador'])
    and (responsavel is null or responsavel in (select m.user_id from hub.membros m where m.conta_id = (select hub.conta_atual()) and m.ativo)));
create policy tarefas_alterar on hub.tarefas for update to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista', 'criador']))
  with check (
    conta_id = (select hub.conta_atual())
    and hub.pode(array['admin', 'estrategista', 'criador'])
    and (responsavel is null or responsavel in (select m.user_id from hub.membros m where m.conta_id = (select hub.conta_atual()) and m.ativo)));
-- Excluir de vez: admin e estrategista.
create policy tarefas_excluir on hub.tarefas for delete to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));

-- Comentários: todo membro ativo do ambiente lê e comenta; cada um exclui só os próprios.
create policy comentarios_ler on hub.tarefa_comentarios for select to authenticated
  using (tarefa_id in (select t.id from hub.tarefas t where t.conta_id = (select hub.conta_atual())));
create policy comentarios_inserir on hub.tarefa_comentarios for insert to authenticated
  with check (tarefa_id in (select t.id from hub.tarefas t where t.conta_id = (select hub.conta_atual())));
create policy comentarios_excluir on hub.tarefa_comentarios for delete to authenticated
  using (autor = (select auth.uid()) and tarefa_id in (select t.id from hub.tarefas t where t.conta_id = (select hub.conta_atual())));

create policy eventos_ler on hub.tarefa_eventos for select to authenticated
  using (conta_id = (select hub.conta_atual()));

-- Tempo real: o Kanban e os comentários atualizam sem recarregar (o RLS vale também aqui).
alter publication supabase_realtime add table hub.tarefas, hub.tarefa_comentarios;

-- ─── 5. Notificações por pessoa ──────────────────────────────────────────────
-- destinatario nulo = todos do ambiente; preenchido = só aquela pessoa.
alter table hub.alertas add column if not exists destinatario uuid references auth.users (id) on delete cascade;
create index if not exists alertas_destinatario_idx on hub.alertas (destinatario);
create unique index if not exists alertas_pessoa_unico on hub.alertas (tipo, chave, destinatario)
  where perfil_id is null and destinatario is not null;

drop policy if exists alertas_ler on hub.alertas;
create policy alertas_ler on hub.alertas for select to authenticated
  using (conta_id = (select hub.conta_atual()) and (destinatario is null or destinatario = (select auth.uid())));
drop policy if exists alertas_marcar_lido on hub.alertas;
create policy alertas_marcar_lido on hub.alertas for update to authenticated
  using (conta_id = (select hub.conta_atual()) and (destinatario is null or destinatario = (select auth.uid())))
  with check (conta_id = (select hub.conta_atual()));

-- Tarefa atrasada: avisa o responsável; sem responsável, avisa os admins do ambiente.
-- A chave inclui o vencimento: o mesmo atraso nunca gera dois avisos; se a data mudar e vencer de novo, avisa outra vez.
create or replace function hub.gerar_alertas_tarefas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link, destinatario)
  select t.conta_id, null, 'tarefa_atrasada',
         format('A tarefa "%s" está atrasada: venceu em %s.', t.titulo, to_char(t.vencimento, 'DD/MM')),
         t.id || ':' || t.vencimento, 'atencao', '/planejador?tarefa=' || t.id, d.uid
  from hub.tarefas t
  cross join lateral (
    select t.responsavel as uid where t.responsavel is not null
    union all
    select m.user_id from hub.membros m
    where t.responsavel is null and m.conta_id = t.conta_id and m.papel = 'admin' and m.ativo
  ) d
  where t.concluida_em is null and t.arquivada_em is null and t.vencimento is not null
    and t.vencimento < hub.hoje_conta(t.conta_id)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Arquivamento automático: 7 dias corridos depois da publicação efetiva.
-- Tarefa restaurada só volta a ser arquivada por nova ação ou nova publicação.
create or replace function hub.arquivar_tarefas_publicadas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  update hub.tarefas t
  set arquivada_em = now(), arquivada_auto = true
  where t.arquivada_em is null
    and t.status = 'publicado'
    and t.data_publicacao is not null
    and t.data_publicacao <= hub.hoje_conta(t.conta_id) - 7
    and (t.restaurada_em is null or t.publicado_em > t.restaurada_em);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function hub.gerar_alertas_tarefas(), hub.arquivar_tarefas_publicadas() from public, anon, authenticated;
grant execute on function hub.gerar_alertas_tarefas(), hub.arquivar_tarefas_publicadas() to service_role;

-- ─── 6. Relatórios: semanal de sexta e por período ───────────────────────────
alter table hub.relatorios
  add column if not exists tipo           text not null default 'semanal',
  add column if not exists periodo_inicio timestamptz,
  add column if not exists periodo_fim    timestamptz;
alter table hub.relatorios drop constraint if exists relatorios_semana_inicio_check;
alter table hub.relatorios drop constraint if exists relatorios_conta_semana_key;
drop index if exists hub.relatorios_conta_semana_key;
alter table hub.relatorios add constraint relatorios_tipo_chk check (tipo in ('semanal', 'personalizado'));
update hub.relatorios
  set periodo_inicio = coalesce(periodo_inicio, semana_inicio::timestamp at time zone 'America/Sao_Paulo'),
      periodo_fim = coalesce(periodo_fim, (semana_fim + 1)::timestamp at time zone 'America/Sao_Paulo');
alter table hub.relatorios alter column periodo_inicio set not null, alter column periodo_fim set not null;
-- Um semanal por período fechado; personalizados nunca sobrescrevem semanais.
create unique index relatorios_semanal_unico on hub.relatorios (conta_id, periodo_fim) where tipo = 'semanal';
create index relatorios_conta_fim_idx on hub.relatorios (conta_id, periodo_fim desc);

-- Monta um relatório do período [p_ini, p_fim) para uma conta. Uso interno.
create or replace function hub.montar_relatorio_periodo(p_conta bigint, p_ini timestamptz, p_fim timestamptz, p_tipo text, p_autor uuid)
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
  v_dados jsonb;
  v_id    bigint;
begin
  with
  ev as (select * from hub.tarefa_eventos e where e.conta_id = p_conta and e.criado_em >= p_ini and e.criado_em < p_fim),
  tf as (select * from hub.tarefas t where t.conta_id = p_conta),
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
  pf as (select p.id, p.handle, p.nome, p.grupo from hub.perfis p where p.ativo and p.conta_id = p_conta),
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
      'por_responsavel', coalesce((select jsonb_agg(to_jsonb(r) order by r.concluidas desc, r.nome) from resp r), '[]')
    ),
    'instagram', jsonb_build_object(
      'perfis', coalesce((select jsonb_agg(to_jsonb(pp) order by pp.seguidores_fim desc nulls last) from por_perfil pp), '[]'),
      'top_posts', coalesce((select jsonb_agg(jsonb_build_object(
          'id', t.id, 'handle', t.handle, 'produto', t.produto, 'tipo', t.tipo,
          'legenda', left(t.legenda, 220), 'permalink', t.permalink, 'thumb_path', t.thumb_path,
          'publicado_em', t.publicado_em, 'likes', t.likes, 'comentarios', t.comentarios, 'views', t.views,
          'interacoes', t.interacoes) order by t.interacoes desc, t.publicado_em desc) from top t), '[]'),
      -- Métricas que a integração não entrega para estes perfis no período (nunca inventamos valor).
      'indisponiveis', to_jsonb(array_remove(array[
        case when not exists (select 1 from posts_p where alcance is not null) then 'alcance' end,
        case when not exists (select 1 from posts_p where compartilhamentos is not null) then 'compartilhamentos' end,
        case when not exists (select 1 from posts_p where salvamentos is not null) then 'salvamentos' end
      ], null))
    )
  ) into v_dados;

  insert into hub.relatorios (conta_id, tipo, semana_inicio, semana_fim, periodo_inicio, periodo_fim, parcial, dados, gerado_em, gerado_por)
  values (p_conta, p_tipo, d_ini, d_fim, p_ini, p_fim, p_fim > now(), v_dados, now(), p_autor)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function hub.montar_relatorio_periodo(bigint, timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function hub.montar_relatorio_periodo(bigint, timestamptz, timestamptz, text, uuid) to service_role;

-- Relatório semanal: toda sexta a partir das 6h no fuso do ambiente, cobrindo desde o fechamento
-- do semanal anterior (sem lacuna e sem sobreposição). Roda de hora em hora; gera uma vez por sexta.
create or replace function hub.gerar_relatorios_semanais()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_fim timestamptz;
  v_ini timestamptz;
  agora_local timestamp;
  n integer := 0;
begin
  for c in select id, fuso from hub.contas loop
    agora_local := now() at time zone c.fuso;
    continue when extract(isodow from agora_local) <> 5 or extract(hour from agora_local) < 6;
    v_fim := (date_trunc('day', agora_local) + interval '6 hours') at time zone c.fuso;
    continue when exists (select 1 from hub.relatorios r where r.conta_id = c.id and r.tipo = 'semanal' and r.periodo_fim = v_fim);
    v_ini := coalesce(
      (select max(r.periodo_fim) from hub.relatorios r where r.conta_id = c.id and r.tipo = 'semanal' and r.periodo_fim < v_fim and r.dados ? 'formato'),
      v_fim - interval '7 days');
    perform hub.montar_relatorio_periodo(c.id, v_ini, v_fim, 'semanal', null);
    insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link)
    values (c.id, null, 'relatorio_semanal',
            format('Relatório semanal de %s a %s pronto.', to_char(v_ini at time zone c.fuso, 'DD/MM'), to_char(v_fim at time zone c.fuso, 'DD/MM')),
            'sexta:' || (v_fim at time zone c.fuso)::date, 'info', '/progresso');
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function hub.gerar_relatorios_semanais() from public, anon, authenticated;
grant execute on function hub.gerar_relatorios_semanais() to service_role;

-- Relatório por período escolhido no app. Não substitui nem altera os semanais.
create or replace function hub.gerar_relatorio_periodo(p_inicio date, p_fim date)
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
  fuso := (select c.fuso from hub.contas c where c.id = conta);
  return hub.montar_relatorio_periodo(conta,
    p_inicio::timestamp at time zone fuso,
    least((p_fim + 1)::timestamp at time zone fuso, clock_timestamp()),
    'personalizado', (select auth.uid()));
end;
$$;
revoke all on function hub.gerar_relatorio_periodo(date, date) from public, anon;
grant execute on function hub.gerar_relatorio_periodo(date, date) to authenticated, service_role;

-- ─── 7. Rotinas agendadas ────────────────────────────────────────────────────
-- A rotina de segunda (relatório antigo) dá lugar à de sexta.
select cron.unschedule('hub-relatorio-semanal') where exists (select 1 from cron.job where jobname = 'hub-relatorio-semanal');
select cron.schedule('hub-relatorio-sexta', '5 * * * *', $$select hub.gerar_relatorios_semanais()$$);
select cron.schedule('hub-tarefas-rotina', '*/15 * * * *', $$select hub.arquivar_tarefas_publicadas(); select hub.gerar_alertas_tarefas()$$);

-- ─── 8. Limpeza ──────────────────────────────────────────────────────────────
-- Funções de gatilho não são chamáveis pela API.
revoke all on function hub.comentario_autor(), hub.tarefas_historico(), hub.tarefas_regras() from public, anon, authenticated;
-- O relatório antigo de segunda (formato 1) deu lugar ao de sexta; os já gerados continuam legíveis.
drop function if exists hub.gerar_relatorio_semanal(date);
drop function if exists hub.montar_relatorio(bigint, date);
