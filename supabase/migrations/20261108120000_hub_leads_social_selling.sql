-- Prefiro Hub · Leads (fase 1): funil de Social Selling.
-- Leads vindos do Instagram, com etapas configuráveis, prazo por etapa, responsável único,
-- Base Geral (reservatório) e Desqualificado. Isolado por ambiente (conta), como o resto do Hub.
-- Nada existente é alterado além de: novo papel "vendedor" e um job novo no pg_cron.

-- ─── 0. Papel Vendedor ───────────────────────────────────────────────────────
-- Trabalha os leads; no resto do Hub só lê (as políticas antigas não o incluem).
alter table hub.membros drop constraint if exists membros_papel_check;
alter table hub.membros add constraint membros_papel_check
  check (papel in ('admin', 'estrategista', 'criador', 'vendedor', 'leitura'));

-- ─── 1. Funis (pipelines) ────────────────────────────────────────────────────
create table hub.lead_pipelines (
  id                bigint generated always as identity primary key,
  conta_id          bigint not null default hub.conta_atual() references hub.contas (id) on delete cascade,
  nome              text not null check (length(btrim(nome)) between 1 and 60),
  tipo              text not null default 'social' check (tipo in ('social', 'personalizado')),
  expira_para_base  boolean not null default true,     -- prazo vencido devolve o lead para a Base Geral
  vida_max_h        integer check (vida_max_h is null or vida_max_h between 1 and 8760),
  arquivado_em      timestamptz,
  criado_em         timestamptz not null default now()
);
create unique index lead_pipelines_nome_unico on hub.lead_pipelines (conta_id, lower(nome));
create index lead_pipelines_conta_idx on hub.lead_pipelines (conta_id);

-- ─── 2. Etapas ───────────────────────────────────────────────────────────────
-- papel: entrada (1ª coluna), trabalho, meta (conta como convertido), futuro (prazo conta da data de retorno),
--        reservatorio (Base Geral, fora do quadro) e terminal (Desqualificado, fora do quadro).
-- exige: o que o lead precisa ter para entrar na etapa.
create table hub.lead_etapas (
  id           bigint generated always as identity primary key,
  pipeline_id  bigint not null references hub.lead_pipelines (id) on delete cascade,
  conta_id     bigint not null references hub.contas (id) on delete cascade,
  nome         text not null check (length(btrim(nome)) between 1 and 40),
  cor          text not null default '#94a3b8' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  posicao      integer not null default 0,
  papel        text not null check (papel in ('entrada', 'trabalho', 'meta', 'futuro', 'reservatorio', 'terminal')),
  prazo_h      integer check (prazo_h is null or prazo_h between 1 and 8760),
  exige        text not null default 'nada' check (exige in ('nada', 'justificativa', 'contato', 'data_retorno')),
  criado_em    timestamptz not null default now()
);
create index lead_etapas_pipeline_idx on hub.lead_etapas (pipeline_id, posicao);
create index lead_etapas_conta_idx on hub.lead_etapas (conta_id);
-- Uma Base Geral e um Desqualificado por funil.
create unique index lead_etapas_fixas_unicas on hub.lead_etapas (pipeline_id, papel) where papel in ('reservatorio', 'terminal');

-- ─── 3. Leads ────────────────────────────────────────────────────────────────
create table hub.leads (
  id             bigint generated always as identity primary key,
  conta_id       bigint not null default hub.conta_atual() references hub.contas (id) on delete cascade,
  pipeline_id    bigint not null references hub.lead_pipelines (id) on delete restrict,
  etapa_id       bigint not null references hub.lead_etapas (id) on delete restrict,
  perfil_id      bigint references hub.perfis (id) on delete set null,   -- perfil próprio de onde o lead veio
  handle         text not null check (handle ~ '^[a-z0-9._]{1,30}$'),
  nome           text check (nome is null or length(nome) <= 120),
  telefone       text check (telefone is null or length(telefone) <= 30),
  email          text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  prioridade     text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
  observacao     text check (observacao is null or length(observacao) <= 2000),
  tags           text[] not null default '{}',
  responsavel    uuid references hub.membros (user_id) on delete set null,
  assumido_em    timestamptz,
  justificativa  text check (justificativa is null or length(justificativa) <= 1000),
  data_retorno   date,
  etapa_desde    timestamptz not null default now(),
  funil_desde    timestamptz not null default now(),   -- relógio do limite total (reinicia ao sair da Base Geral)
  expira_em      timestamptz,                          -- calculado pelo banco
  expirado_em    timestamptz,                          -- última vez que voltou para a Base Geral por prazo
  criado_em      timestamptz not null default now(),
  criado_por     uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references auth.users (id) on delete set null
);
-- Um lead por @ em cada ambiente: o Desqualificado bloqueia cadastro repetido e ninguém cadastra o mesmo perfil duas vezes.
create unique index leads_conta_handle_unico on hub.leads (conta_id, handle);
create index leads_conta_etapa_idx on hub.leads (conta_id, pipeline_id, etapa_id);
create index leads_expira_idx on hub.leads (expira_em) where expira_em is not null;
create index leads_responsavel_idx on hub.leads (responsavel);
create index leads_perfil_idx on hub.leads (perfil_id);
create index leads_etapa_idx on hub.leads (etapa_id);
create index leads_criado_por_idx on hub.leads (criado_por);
create index leads_atualizado_por_idx on hub.leads (atualizado_por);

create table hub.lead_notas (
  id         bigint generated always as identity primary key,
  lead_id    bigint not null references hub.leads (id) on delete cascade,
  autor      uuid default auth.uid() references auth.users (id) on delete set null,
  autor_nome text not null default '',
  texto      text not null check (length(btrim(texto)) between 1 and 2000),
  criado_em  timestamptz not null default now()
);
create index lead_notas_lead_idx on hub.lead_notas (lead_id, criado_em);
create index lead_notas_autor_idx on hub.lead_notas (autor);

create table hub.lead_eventos (
  id         bigint generated always as identity primary key,
  lead_id    bigint not null references hub.leads (id) on delete cascade,
  conta_id   bigint not null references hub.contas (id) on delete cascade,
  tipo       text not null check (tipo in ('criado', 'etapa', 'assumido', 'responsavel', 'expirado', 'perfil', 'prioridade')),
  de         text,
  para       text,
  detalhe    text,
  autor      uuid references auth.users (id) on delete set null,
  autor_nome text not null default 'Sistema',
  criado_em  timestamptz not null default now()
);
create index lead_eventos_lead_idx on hub.lead_eventos (lead_id, criado_em);
create index lead_eventos_conta_idx on hub.lead_eventos (conta_id, criado_em);
create index lead_eventos_autor_idx on hub.lead_eventos (autor);

-- ─── 4. Regras do lead ───────────────────────────────────────────────────────
-- Prazo: a partir da entrada na etapa (ou da data de retorno, na etapa "futuro").
-- Limite total: desde a entrada no funil, exceto na meta. Base Geral e Desqualificado não expiram.
create or replace function hub.lead_calcular_expiracao(p_etapa bigint, p_etapa_desde timestamptz, p_funil_desde timestamptz, p_data_retorno date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not p.expira_para_base or e.papel in ('reservatorio', 'terminal') then null
    else nullif(least(
      coalesce(
        case when e.prazo_h is null then null
             when e.papel = 'futuro' and p_data_retorno is not null
               then (p_data_retorno::timestamp at time zone coalesce(c.fuso, 'America/Sao_Paulo')) + make_interval(hours => e.prazo_h)
             else p_etapa_desde + make_interval(hours => e.prazo_h) end,
        'infinity'::timestamptz),
      coalesce(
        case when p.vida_max_h is null or e.papel = 'meta' then null
             else p_funil_desde + make_interval(hours => p.vida_max_h) end,
        'infinity'::timestamptz)
    ), 'infinity'::timestamptz)
  end
  from hub.lead_etapas e
  join hub.lead_pipelines p on p.id = e.pipeline_id
  join hub.contas c on c.id = e.conta_id
  where e.id = p_etapa
$$;
revoke all on function hub.lead_calcular_expiracao(bigint, timestamptz, timestamptz, date) from public, anon, authenticated;

create or replace function hub.leads_regras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  et     hub.lead_etapas%rowtype;
  et_ant hub.lead_etapas%rowtype;
  mudou_etapa boolean;
begin
  new.handle := lower(btrim(regexp_replace(coalesce(new.handle, ''), '^@', '')));
  new.nome := nullif(btrim(new.nome), '');
  new.telefone := nullif(btrim(new.telefone), '');
  new.email := nullif(lower(btrim(new.email)), '');
  new.observacao := nullif(btrim(new.observacao), '');
  new.justificativa := nullif(btrim(new.justificativa), '');
  new.atualizado_em := now();
  new.atualizado_por := coalesce((select auth.uid()), new.atualizado_por);

  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := coalesce((select auth.uid()), new.criado_por);
    if new.pipeline_id is null then
      select p.id into new.pipeline_id from hub.lead_pipelines p
      where p.conta_id = new.conta_id and p.arquivado_em is null order by (p.tipo = 'social') desc, p.id limit 1;
    end if;
    if exists (select 1 from hub.lead_pipelines p where p.id = new.pipeline_id and p.arquivado_em is not null) then
      raise exception 'Este funil está arquivado.' using errcode = '23514';
    end if;
    if new.etapa_id is null then
      select e.id into new.etapa_id from hub.lead_etapas e where e.pipeline_id = new.pipeline_id and e.papel = 'entrada' order by e.posicao limit 1;
    end if;
    -- Quem cadastra assume o lead (exceto se cadastrar direto na Base Geral).
    new.responsavel := coalesce(new.responsavel, (select auth.uid()));
    mudou_etapa := true;
  else
    new.conta_id := old.conta_id;
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
    mudou_etapa := new.etapa_id is distinct from old.etapa_id;
  end if;

  select * into et from hub.lead_etapas e where e.id = new.etapa_id;
  if et.id is null or et.pipeline_id <> new.pipeline_id or et.conta_id <> new.conta_id then
    raise exception 'A etapa não pertence a este funil.' using errcode = '23514';
  end if;
  if new.perfil_id is not null and (tg_op = 'INSERT' or new.perfil_id is distinct from old.perfil_id)
     and not hub.perfil_proprio_da_conta(new.perfil_id, new.conta_id) then
    raise exception 'O perfil escolhido não é um perfil próprio deste ambiente.' using errcode = '23503';
  end if;

  if mudou_etapa then
    -- O que a etapa exige para o lead entrar.
    if et.exige = 'justificativa' and new.justificativa is null then
      raise exception 'Para entrar em %, escreva o motivo (justificativa).', et.nome using errcode = '23514';
    elsif et.exige = 'contato' and (new.telefone is null or new.email is null) then
      raise exception 'Para entrar em %, preencha telefone e e-mail do lead.', et.nome using errcode = '23514';
    elsif et.exige = 'data_retorno' and new.data_retorno is null then
      raise exception 'Para entrar em %, escolha a data para retomar o contato.', et.nome using errcode = '23514';
    end if;

    new.etapa_desde := clock_timestamp();
    if et.papel = 'reservatorio' then
      new.responsavel := null;
    end if;
    if tg_op = 'UPDATE' then
      select * into et_ant from hub.lead_etapas e where e.id = old.etapa_id;
      -- Saiu da Base Geral: o relógio do limite total reinicia.
      if et_ant.papel = 'reservatorio' then
        new.funil_desde := clock_timestamp();
      end if;
      -- Trocou de funil: entra pela etapa escolhida e o relógio total reinicia.
      if new.pipeline_id <> old.pipeline_id then
        new.funil_desde := clock_timestamp();
      end if;
    else
      new.funil_desde := clock_timestamp();
    end if;
  elsif tg_op = 'UPDATE' and new.pipeline_id <> old.pipeline_id then
    raise exception 'Para trocar de funil, escolha também a etapa.' using errcode = '23514';
  end if;

  -- Dono novo: registra quando assumiu.
  if new.responsavel is not null and (tg_op = 'INSERT' or new.responsavel is distinct from old.responsavel) then
    new.assumido_em := clock_timestamp();
  elsif new.responsavel is null then
    new.assumido_em := null;
  end if;

  new.expira_em := hub.lead_calcular_expiracao(new.etapa_id, new.etapa_desde, new.funil_desde, new.data_retorno);
  return new;
end;
$$;
revoke all on function hub.leads_regras() from public, anon, authenticated;
create trigger leads_regras before insert or update on hub.leads
  for each row execute function hub.leads_regras();

-- Histórico.
create or replace function hub.leads_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  nome text := coalesce((select m.nome from hub.membros m where m.user_id = (select auth.uid())), 'Sistema');
  en   text;
begin
  if tg_op = 'INSERT' then
    insert into hub.lead_eventos (lead_id, conta_id, tipo, para, autor, autor_nome)
    values (new.id, new.conta_id, 'criado', (select e.nome from hub.lead_etapas e where e.id = new.etapa_id), quem, nome);
    return new;
  end if;
  if new.etapa_id is distinct from old.etapa_id then
    en := (select e.nome from hub.lead_etapas e where e.id = new.etapa_id);
    insert into hub.lead_eventos (lead_id, conta_id, tipo, de, para, detalhe, autor, autor_nome)
    values (new.id, new.conta_id,
            case when new.expirado_em is distinct from old.expirado_em then 'expirado' else 'etapa' end,
            (select e.nome from hub.lead_etapas e where e.id = old.etapa_id), en,
            case when new.justificativa is distinct from old.justificativa then new.justificativa end,
            quem, nome);
  end if;
  if new.responsavel is distinct from old.responsavel and not (new.expirado_em is distinct from old.expirado_em) then
    insert into hub.lead_eventos (lead_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, case when old.responsavel is null and new.responsavel = quem then 'assumido' else 'responsavel' end,
            old.responsavel::text, new.responsavel::text, quem, nome);
  end if;
  if new.perfil_id is distinct from old.perfil_id then
    insert into hub.lead_eventos (lead_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, 'perfil',
            (select p.handle from hub.perfis p where p.id = old.perfil_id),
            (select p.handle from hub.perfis p where p.id = new.perfil_id), quem, nome);
  end if;
  if new.prioridade is distinct from old.prioridade then
    insert into hub.lead_eventos (lead_id, conta_id, tipo, de, para, autor, autor_nome)
    values (new.id, new.conta_id, 'prioridade', old.prioridade, new.prioridade, quem, nome);
  end if;
  return new;
end;
$$;
revoke all on function hub.leads_historico() from public, anon, authenticated;
create trigger leads_historico after insert or update on hub.leads
  for each row execute function hub.leads_historico();

create or replace function hub.lead_nota_autor()
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
revoke all on function hub.lead_nota_autor() from public, anon, authenticated;
create trigger lead_notas_autor before insert on hub.lead_notas
  for each row execute function hub.lead_nota_autor();

-- ─── 5. Acesso (RLS) ─────────────────────────────────────────────────────────
-- Ler: todo membro ativo do ambiente. Configurar funis: admin.
-- Cadastrar lead: admin, estrategista, criador e vendedor.
-- Mexer num lead: o responsável dele, ou admin/estrategista (gestão). Assumir é pela função hub.assumir_lead.
-- Excluir lead: admin e estrategista.
alter table hub.lead_pipelines enable row level security;
alter table hub.lead_etapas enable row level security;
alter table hub.leads enable row level security;
alter table hub.lead_notas enable row level security;
alter table hub.lead_eventos enable row level security;
grant select on hub.lead_pipelines, hub.lead_etapas, hub.lead_eventos to authenticated;
grant select, insert, update, delete on hub.leads, hub.lead_notas to authenticated;
grant update (nome, expira_para_base, vida_max_h) on hub.lead_pipelines to authenticated;
grant all on hub.lead_pipelines, hub.lead_etapas, hub.leads, hub.lead_notas, hub.lead_eventos to service_role;

create policy lead_pipelines_ler on hub.lead_pipelines for select to authenticated using (conta_id = (select hub.conta_atual()));
create policy lead_pipelines_alterar on hub.lead_pipelines for update to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin']))
  with check (conta_id = (select hub.conta_atual()) and hub.pode(array['admin']));
create policy lead_etapas_ler on hub.lead_etapas for select to authenticated using (conta_id = (select hub.conta_atual()));

create policy leads_ler on hub.leads for select to authenticated using (conta_id = (select hub.conta_atual()));
create policy leads_inserir on hub.leads for insert to authenticated
  with check (
    conta_id = (select hub.conta_atual())
    and hub.pode(array['admin', 'estrategista', 'criador', 'vendedor'])
    and (responsavel is null or responsavel = (select auth.uid())
         or (hub.pode(array['admin', 'estrategista'])
             and responsavel in (select m.user_id from hub.membros m where m.conta_id = (select hub.conta_atual()) and m.ativo))));
create policy leads_alterar on hub.leads for update to authenticated
  using (conta_id = (select hub.conta_atual())
         and (hub.pode(array['admin', 'estrategista'])
              or (hub.pode(array['criador', 'vendedor']) and responsavel = (select auth.uid()))))
  with check (conta_id = (select hub.conta_atual())
         and (responsavel is null or responsavel in (select m.user_id from hub.membros m where m.conta_id = (select hub.conta_atual()) and m.ativo))
         and (hub.pode(array['admin', 'estrategista'])
              or (hub.pode(array['criador', 'vendedor']) and (responsavel is null or responsavel = (select auth.uid())))));
create policy leads_excluir on hub.leads for delete to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));

create policy lead_notas_ler on hub.lead_notas for select to authenticated
  using (lead_id in (select l.id from hub.leads l where l.conta_id = (select hub.conta_atual())));
create policy lead_notas_inserir on hub.lead_notas for insert to authenticated
  with check (hub.pode(array['admin', 'estrategista', 'criador', 'vendedor'])
              and lead_id in (select l.id from hub.leads l where l.conta_id = (select hub.conta_atual())));
create policy lead_notas_excluir on hub.lead_notas for delete to authenticated
  using (autor = (select auth.uid()) and lead_id in (select l.id from hub.leads l where l.conta_id = (select hub.conta_atual())));

create policy lead_eventos_ler on hub.lead_eventos for select to authenticated using (conta_id = (select hub.conta_atual()));

alter publication supabase_realtime add table hub.leads;

-- ─── 6. Assumir lead (um dono só, sem corrida) ───────────────────────────────
-- Da Base Geral, o lead volta para a entrada do funil escolhido (ou do próprio funil).
create or replace function hub.assumir_lead(p_lead bigint, p_pipeline bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu    uuid := (select auth.uid());
  conta bigint := hub.conta_atual();
  l     hub.leads%rowtype;
  e     hub.lead_etapas%rowtype;
  destino_pipe bigint;
  destino_etapa bigint;
begin
  if conta is null or not hub.pode(array['admin', 'estrategista', 'criador', 'vendedor']) then
    raise exception 'Seu papel não permite assumir leads.' using errcode = '42501';
  end if;
  select * into l from hub.leads where id = p_lead and conta_id = conta for update;
  if l.id is null then
    raise exception 'Lead não encontrado.' using errcode = 'P0002';
  end if;
  if l.responsavel is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_tem_dono', 'dono_id', l.responsavel,
      'dono_nome', (select m.nome from hub.membros m where m.user_id = l.responsavel));
  end if;
  select * into e from hub.lead_etapas where id = l.etapa_id;
  if e.papel = 'terminal' then
    return jsonb_build_object('ok', false, 'motivo', 'desqualificado');
  end if;
  if e.papel = 'reservatorio' then
    destino_pipe := coalesce(p_pipeline, l.pipeline_id);
    if not exists (select 1 from hub.lead_pipelines p where p.id = destino_pipe and p.conta_id = conta and p.arquivado_em is null) then
      raise exception 'Escolha um funil ativo deste ambiente.' using errcode = '22023';
    end if;
    select x.id into destino_etapa from hub.lead_etapas x where x.pipeline_id = destino_pipe and x.papel = 'entrada' order by x.posicao limit 1;
    update hub.leads set responsavel = eu, pipeline_id = destino_pipe, etapa_id = destino_etapa where id = l.id;
  else
    update hub.leads set responsavel = eu where id = l.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function hub.assumir_lead(bigint, bigint) from public, anon;
grant execute on function hub.assumir_lead(bigint, bigint) to authenticated, service_role;

-- ─── 7. Funil padrão de Social Selling ───────────────────────────────────────
create or replace function hub.criar_funil_social(p_conta bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare p bigint;
begin
  select id into p from hub.lead_pipelines where conta_id = p_conta and tipo = 'social' limit 1;
  if p is not null then return p; end if;
  insert into hub.lead_pipelines (conta_id, nome, tipo) values (p_conta, 'Social Selling', 'social') returning id into p;
  insert into hub.lead_etapas (pipeline_id, conta_id, nome, cor, posicao, papel, prazo_h, exige) values
    (p, p_conta, 'Novo',                '#4ade80', 1, 'entrada',      72,   'nada'),
    (p, p_conta, 'Follow-up',           '#a78bfa', 2, 'trabalho',     48,   'nada'),
    (p, p_conta, 'Qualificado',         '#2dd4bf', 3, 'trabalho',     48,   'justificativa'),
    (p, p_conta, 'Agendado',            '#fbbf24', 4, 'meta',         168,  'contato'),
    (p, p_conta, 'Oportunidade futura', '#8b5cf6', 5, 'futuro',       96,   'data_retorno'),
    (p, p_conta, 'Base Geral',          '#94a3b8', 90, 'reservatorio', null, 'nada'),
    (p, p_conta, 'Desqualificado',      '#f87171', 91, 'terminal',     null, 'nada');
  return p;
end;
$$;
revoke all on function hub.criar_funil_social(bigint) from public, anon, authenticated;

create or replace function hub.contas_funil_padrao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform hub.criar_funil_social(new.id);
  return new;
end;
$$;
revoke all on function hub.contas_funil_padrao() from public, anon, authenticated;
create trigger contas_funil_padrao after insert on hub.contas
  for each row execute function hub.contas_funil_padrao();

select hub.criar_funil_social(c.id) from hub.contas c;

-- ─── 8. Configurar etapas (admin) ────────────────────────────────────────────
-- Recebe a lista ordenada das colunas do quadro: [{id?, nome, cor, prazo_h, exige, meta}].
-- A 1ª coluna é a entrada; "data_retorno" vira etapa de futuro; só uma meta. Base Geral e Desqualificado
-- ficam fixos. Coluna removida só sai se não tiver lead. Prazo novo vale para quem entrar daqui pra frente.
create or replace function hub.salvar_etapas(p_pipeline bigint, p_etapas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  conta bigint := hub.conta_atual();
  item jsonb;
  i integer := 0;
  n integer;
  metas integer;
  manter bigint[] := '{}';
  v_id bigint;
  v_papel text;
  v_exige text;
  v_prazo integer;
begin
  if conta is null or not hub.pode(array['admin']) then
    raise exception 'Só admins configuram os funis.' using errcode = '42501';
  end if;
  if not exists (select 1 from hub.lead_pipelines p where p.id = p_pipeline and p.conta_id = conta) then
    raise exception 'Funil não encontrado.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_etapas) <> 'array' then
    raise exception 'Lista de colunas inválida.' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_etapas);
  if n < 2 or n > 12 then
    raise exception 'O funil precisa ter de 2 a 12 colunas.' using errcode = '22023';
  end if;
  select count(*) into metas from jsonb_array_elements(p_etapas) x where (x->>'meta')::boolean is true;
  if metas > 1 then
    raise exception 'Só uma coluna pode ser a meta.' using errcode = '22023';
  end if;
  if (p_etapas->0->>'exige') = 'data_retorno' then
    raise exception 'A primeira coluna não pode pedir data de retorno.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_etapas) loop
    i := i + 1;
    v_exige := coalesce(item->>'exige', 'nada');
    if v_exige not in ('nada', 'justificativa', 'contato', 'data_retorno') then
      raise exception 'Exigência inválida na coluna %.', i using errcode = '22023';
    end if;
    if length(btrim(coalesce(item->>'nome', ''))) not between 1 and 40 then
      raise exception 'Dê um nome de até 40 caracteres à coluna %.', i using errcode = '22023';
    end if;
    if lower(btrim(item->>'nome')) in ('base geral', 'desqualificado') then
      raise exception '"%" é um nome reservado.', btrim(item->>'nome') using errcode = '22023';
    end if;
    v_prazo := nullif(item->>'prazo_h', '')::integer;
    if v_prazo is not null and (v_prazo < 1 or v_prazo > 8760) then
      raise exception 'O prazo da coluna % precisa ficar entre 1 hora e 365 dias.', i using errcode = '22023';
    end if;
    v_papel := case when i = 1 then 'entrada'
                    when (item->>'meta')::boolean is true then 'meta'
                    when v_exige = 'data_retorno' then 'futuro'
                    else 'trabalho' end;
    v_id := nullif(item->>'id', '')::bigint;
    if v_id is not null then
      update hub.lead_etapas set nome = btrim(item->>'nome'), cor = coalesce(item->>'cor', cor), posicao = i,
        papel = v_papel, prazo_h = v_prazo, exige = v_exige
      where id = v_id and pipeline_id = p_pipeline and papel not in ('reservatorio', 'terminal');
      if not found then
        raise exception 'Coluna % não pertence a este funil.', i using errcode = '22023';
      end if;
    else
      insert into hub.lead_etapas (pipeline_id, conta_id, nome, cor, posicao, papel, prazo_h, exige)
      values (p_pipeline, conta, btrim(item->>'nome'), coalesce(item->>'cor', '#94a3b8'), i, v_papel, v_prazo, v_exige)
      returning id into v_id;
    end if;
    manter := manter || v_id;
  end loop;

  if exists (select 1 from hub.lead_etapas e join hub.leads l on l.etapa_id = e.id
             where e.pipeline_id = p_pipeline and e.papel not in ('reservatorio', 'terminal') and not (e.id = any (manter))) then
    raise exception 'Uma coluna removida ainda tem leads. Mova os leads antes de remover.' using errcode = '23503';
  end if;
  delete from hub.lead_etapas e where e.pipeline_id = p_pipeline and e.papel not in ('reservatorio', 'terminal') and not (e.id = any (manter));
end;
$$;
revoke all on function hub.salvar_etapas(bigint, jsonb) from public, anon;
grant execute on function hub.salvar_etapas(bigint, jsonb) to authenticated, service_role;

-- ─── 9. Expiração (pg_cron) ──────────────────────────────────────────────────
-- Prazo vencido: o lead perde o responsável e volta para a Base Geral. Nada é apagado.
-- Quem era o responsável recebe um aviso no sino.
create or replace function hub.expirar_leads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select l.id, l.conta_id, l.handle, l.responsavel, e.nome as etapa, b.id as base_id
    from hub.leads l
    join hub.lead_etapas e on e.id = l.etapa_id
    join hub.lead_etapas b on b.pipeline_id = l.pipeline_id and b.papel = 'reservatorio'
    join hub.lead_pipelines p on p.id = l.pipeline_id
    -- Desligar a expiração no funil vale também para quem já está nele.
    where l.expira_em is not null and l.expira_em <= now() and p.expira_para_base
    for update of l skip locked
  loop
    update hub.leads set etapa_id = r.base_id, expirado_em = clock_timestamp() where id = r.id;
    if r.responsavel is not null then
      insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link, destinatario)
      values (r.conta_id, null, 'lead_expirado',
              format('O lead @%s ficou parado em %s e voltou para a Base Geral.', r.handle, r.etapa),
              'lead:' || r.id || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MI'), 'atencao',
              '/leads/base?lead=' || r.id, r.responsavel)
      on conflict do nothing;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function hub.expirar_leads() from public, anon, authenticated;
grant execute on function hub.expirar_leads() to service_role;

select cron.schedule('hub-leads-expiracao', '*/10 * * * *', $$select hub.expirar_leads()$$);
