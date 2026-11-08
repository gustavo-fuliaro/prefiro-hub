-- Prefiro Hub · Formulários/Iscas (estilo Typeform) ligados ao funil de leads.
-- Cada formulário tem um rascunho (perguntas) e uma versão publicada (o que o público vê).
-- Visitante sem login só acessa quatro funções públicas abaixo; nenhuma tabela fica exposta.

-- ─── 0. Segurança do esquema ─────────────────────────────────────────────────
-- Função nova no esquema hub não nasce executável por qualquer um (o padrão do Postgres é PUBLIC).
alter default privileges in schema hub revoke execute on functions from public;
revoke execute on function hub.tocar_atualizado_em() from public, anon;
revoke execute on function hub.manter_capa() from public, anon;
-- O visitante precisa "enxergar" o esquema para chamar as funções públicas; tabelas continuam sem grant.
grant usage on schema hub to anon;

-- ─── 1. Formulários ──────────────────────────────────────────────────────────
create table hub.formularios (
  id            bigint generated always as identity primary key,
  conta_id      bigint not null default hub.conta_atual() references hub.contas (id) on delete cascade,
  titulo        text not null check (length(btrim(titulo)) between 1 and 120),
  descricao     text check (descricao is null or length(descricao) <= 500),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  modo          text not null default 'passo' check (modo in ('passo', 'lista')),
  tema          jsonb not null default '{}'::jsonb,
  perguntas     jsonb not null default '[]'::jsonb check (jsonb_typeof(perguntas) = 'array'),
  final         jsonb not null default '{}'::jsonb,       -- tela de obrigado: titulo, texto, botao, link (a isca)
  publicado     jsonb,                                     -- foto da versão no ar (null = fora do ar)
  publicado_em  timestamptz,
  pipeline_id   bigint references hub.lead_pipelines (id) on delete set null,
  etapa_id      bigint references hub.lead_etapas (id) on delete set null,
  responsavel   uuid references hub.membros (user_id) on delete set null,
  perfil_id     bigint references hub.perfis (id) on delete set null,
  etiqueta      text check (etiqueta is null or length(etiqueta) <= 40),
  visitas       integer not null default 0,
  criado_em     timestamptz not null default now(),
  criado_por    uuid default auth.uid() references auth.users (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index formularios_conta_idx on hub.formularios (conta_id);
create index formularios_pipeline_idx on hub.formularios (pipeline_id);
create index formularios_etapa_idx on hub.formularios (etapa_id);
create index formularios_responsavel_idx on hub.formularios (responsavel);
create index formularios_perfil_idx on hub.formularios (perfil_id);
create index formularios_criado_por_idx on hub.formularios (criado_por);

create table hub.formulario_respostas (
  id             bigint generated always as identity primary key,
  formulario_id  bigint not null references hub.formularios (id) on delete cascade,
  conta_id       bigint not null references hub.contas (id) on delete cascade,
  sessao         uuid not null,
  ip_hash        text,
  respostas      jsonb not null default '{}'::jsonb,
  origem         jsonb not null default '{}'::jsonb,       -- utm_* e referência de onde veio
  iniciado_em    timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  concluido_em   timestamptz,
  qualificado    boolean,
  lead_id        bigint references hub.leads (id) on delete set null,
  lead_status    text check (lead_status in ('criado', 'existente', 'sem_funil', 'erro')),
  lead_erro      text,
  unique (formulario_id, sessao)
);
create index formulario_respostas_form_idx on hub.formulario_respostas (formulario_id, iniciado_em desc);
create index formulario_respostas_conta_idx on hub.formulario_respostas (conta_id);
create index formulario_respostas_lead_idx on hub.formulario_respostas (lead_id);
create index formulario_respostas_ip_idx on hub.formulario_respostas (formulario_id, ip_hash, iniciado_em);

create or replace function hub.formularios_regras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.titulo := btrim(new.titulo);
  new.slug := lower(btrim(new.slug));
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then
    new.conta_id := old.conta_id;
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
    new.visitas := old.visitas;
    -- Publicar e tirar do ar só pelas funções (que validam).
    if current_setting('hub.publicando', true) is distinct from 'sim' then
      new.publicado := old.publicado;
      new.publicado_em := old.publicado_em;
    end if;
  else
    new.publicado := null;
    new.publicado_em := null;
    new.visitas := 0;
  end if;
  if new.pipeline_id is not null and not exists (select 1 from hub.lead_pipelines p where p.id = new.pipeline_id and p.conta_id = new.conta_id) then
    raise exception 'O funil escolhido não é deste ambiente.' using errcode = '23503';
  end if;
  if new.etapa_id is not null and not exists (select 1 from hub.lead_etapas e where e.id = new.etapa_id and e.pipeline_id = new.pipeline_id) then
    raise exception 'A etapa escolhida não é deste funil.' using errcode = '23503';
  end if;
  if new.perfil_id is not null and (tg_op = 'INSERT' or new.perfil_id is distinct from old.perfil_id)
     and not hub.perfil_proprio_da_conta(new.perfil_id, new.conta_id) then
    raise exception 'O perfil escolhido não é um perfil próprio deste ambiente.' using errcode = '23503';
  end if;
  if new.responsavel is not null and not exists (select 1 from hub.membros m where m.user_id = new.responsavel and m.conta_id = new.conta_id and m.ativo) then
    raise exception 'O responsável escolhido não faz parte deste ambiente.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function hub.formularios_regras() from public, anon, authenticated;
create trigger formularios_regras before insert or update on hub.formularios
  for each row execute function hub.formularios_regras();

alter table hub.formularios enable row level security;
alter table hub.formulario_respostas enable row level security;
grant select, insert, update, delete on hub.formularios to authenticated;
grant select, delete on hub.formulario_respostas to authenticated;
grant all on hub.formularios, hub.formulario_respostas to service_role;

create policy formularios_ler on hub.formularios for select to authenticated using (conta_id = (select hub.conta_atual()));
create policy formularios_inserir on hub.formularios for insert to authenticated
  with check (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista', 'criador']));
create policy formularios_alterar on hub.formularios for update to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista', 'criador']))
  with check (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista', 'criador']));
create policy formularios_excluir on hub.formularios for delete to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));
create policy respostas_ler on hub.formulario_respostas for select to authenticated using (conta_id = (select hub.conta_atual()));
create policy respostas_excluir on hub.formulario_respostas for delete to authenticated
  using (conta_id = (select hub.conta_atual()) and hub.pode(array['admin', 'estrategista']));

-- ─── 2. Notas e histórico vindos do formulário ───────────────────────────────
-- Nota gravada pelo sistema (sem login) mantém o nome do autor informado (ex.: "Formulário").
create or replace function hub.lead_nota_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.autor := (select auth.uid());
    new.autor_nome := coalesce((select m.nome from hub.membros m where m.user_id = new.autor), 'Usuário');
  else
    new.autor := null;
    new.autor_nome := coalesce(nullif(btrim(new.autor_nome), ''), 'Sistema');
  end if;
  new.texto := btrim(new.texto);
  new.criado_em := now();
  return new;
end;
$$;
revoke all on function hub.lead_nota_autor() from public, anon, authenticated;

alter table hub.lead_eventos drop constraint if exists lead_eventos_tipo_check;
alter table hub.lead_eventos add constraint lead_eventos_tipo_check
  check (tipo in ('criado', 'etapa', 'assumido', 'responsavel', 'expirado', 'perfil', 'prioridade', 'formulario'));

-- ─── 3. Regras de exibição (lógica de pulo) ──────────────────────────────────
-- condicao = {logica: 'e'|'ou', regras: [{pergunta, operador, valor}]}. Mesma regra da página pública.
create or replace function hub.form_regra(p_regra jsonb, p_respostas jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  bruto jsonb := p_respostas -> (p_regra->>'pergunta');
  av text;
  val text := coalesce(p_regra->>'valor', '');
  op text := coalesce(p_regra->>'operador', 'igual');
  an numeric;
  vn numeric;
begin
  av := case when bruto is null or jsonb_typeof(bruto) = 'null' then ''
             when jsonb_typeof(bruto) = 'array' then (select coalesce(string_agg(x, ', '), '') from jsonb_array_elements_text(bruto) x)
             else bruto #>> '{}' end;
  if op in ('maior', 'menor') then
    begin
      an := replace(av, ',', '.')::numeric;
      vn := replace(val, ',', '.')::numeric;
    exception when others then
      return false;
    end;
    return case op when 'maior' then an > vn else an < vn end;
  end if;
  return case op
    when 'diferente' then av <> val
    when 'contem' then position(lower(val) in lower(av)) > 0
    when 'nao_contem' then position(lower(val) in lower(av)) = 0
    when 'preenchida' then btrim(av) <> ''
    when 'vazia' then btrim(av) = ''
    -- escolha múltipla: "igual a X" vale se X está entre as marcadas
    else av = val or (jsonb_typeof(bruto) = 'array' and bruto ? val)
  end;
end;
$$;

create or replace function hub.form_visivel(p_pergunta jsonb, p_respostas jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_pergunta->'condicao' is null or jsonb_typeof(p_pergunta->'condicao'->'regras') is distinct from 'array'
      or jsonb_array_length(p_pergunta->'condicao'->'regras') = 0 then true
    when p_pergunta->'condicao'->>'logica' = 'ou'
      then exists (select 1 from jsonb_array_elements(p_pergunta->'condicao'->'regras') r where hub.form_regra(r, p_respostas))
    else not exists (select 1 from jsonb_array_elements(p_pergunta->'condicao'->'regras') r where not hub.form_regra(r, p_respostas))
  end
$$;
revoke all on function hub.form_regra(jsonb, jsonb), hub.form_visivel(jsonb, jsonb) from public, anon;
grant execute on function hub.form_regra(jsonb, jsonb), hub.form_visivel(jsonb, jsonb) to authenticated, service_role;

-- Valor de resposta como texto (lista vira "a, b").
create or replace function hub.form_texto(p_valor jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_valor is null or jsonb_typeof(p_valor) = 'null' then null
              when jsonb_typeof(p_valor) = 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(p_valor) x)
              else nullif(btrim(p_valor #>> '{}'), '') end
$$;
revoke all on function hub.form_texto(jsonb) from public, anon;

-- ─── 4. Publicar e tirar do ar ───────────────────────────────────────────────
create or replace function hub.form_problemas(p_form hub.formularios)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p text[] := '{}';
  q jsonb;
  et hub.lead_etapas%rowtype;
  respondiveis int := 0;
  tem_insta boolean := false;
  tem_email boolean := false;
  tem_tel boolean := false;
  ids text[] := '{}';
begin
  for q in select value from jsonb_array_elements(p_form.perguntas) loop
    if coalesce(q->>'id', '') = '' or q->>'id' = any (ids) then
      p := p || 'Há perguntas sem identificador. Salve o formulário de novo.'::text;
    end if;
    ids := ids || (q->>'id');
    if q->>'tipo' not in ('boas_vindas', 'mensagem') then
      respondiveis := respondiveis + 1;
      if length(btrim(coalesce(q->>'titulo', ''))) = 0 then p := p || format('A pergunta %s está sem título.', respondiveis); end if;
    end if;
    if q->>'tipo' in ('escolha_unica', 'multipla_escolha', 'lista') then
      if jsonb_typeof(q->'opcoes') is distinct from 'array' or jsonb_array_length(q->'opcoes') < 2 then
        p := p || format('"%s" precisa de pelo menos 2 opções.', coalesce(q->>'titulo', 'Pergunta'));
      end if;
      if (q->'qualificacao'->>'ativa')::boolean is true
         and not exists (select 1 from jsonb_array_elements(coalesce(q->'qualificacao'->'qualifica', '[]')) x where x = 'true'::jsonb) then
        p := p || format('Marque ao menos uma opção que qualifica em "%s".', coalesce(q->>'titulo', 'Pergunta'));
      end if;
    end if;
    if q->>'tipo' = 'instagram' and (q->>'obrigatoria')::boolean is true and q->'condicao' is null then tem_insta := true; end if;
    if q->>'tipo' = 'email' and (q->>'obrigatoria')::boolean is true and q->'condicao' is null then tem_email := true; end if;
    if q->>'tipo' = 'telefone' and (q->>'obrigatoria')::boolean is true and q->'condicao' is null then tem_tel := true; end if;
  end loop;
  if respondiveis = 0 then p := p || 'Adicione pelo menos uma pergunta.'::text; end if;
  if jsonb_array_length(p_form.perguntas) > 60 then p := p || 'Use até 60 perguntas.'::text; end if;

  if p_form.pipeline_id is not null then
    if p_form.etapa_id is null then
      p := p || 'Escolha a etapa em que o lead entra no funil.'::text;
    else
      select * into et from hub.lead_etapas where id = p_form.etapa_id;
      if et.papel in ('reservatorio', 'terminal', 'futuro') or et.exige in ('justificativa', 'data_retorno') then
        p := p || format('A etapa %s não recebe leads de formulário. Escolha outra.', et.nome);
      elsif et.exige = 'contato' and not (tem_email and tem_tel) then
        p := p || format('A etapa %s pede telefone e e-mail: inclua as duas perguntas como obrigatórias e sem condição.', et.nome);
      end if;
    end if;
    if not tem_insta then
      p := p || 'Para criar leads no funil, inclua a pergunta "Instagram" como obrigatória e sem condição (o @ identifica o lead).'::text;
    end if;
  end if;
  return p;
end;
$$;
revoke all on function hub.form_problemas(hub.formularios) from public, anon, authenticated;

create or replace function hub.form_publicar(p_id bigint)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  f hub.formularios%rowtype;
  probs text[];
begin
  if not hub.pode(array['admin', 'estrategista', 'criador']) then
    raise exception 'Seu papel não permite publicar formulários.' using errcode = '42501';
  end if;
  select * into f from hub.formularios where id = p_id and conta_id = hub.conta_atual();
  if f.id is null then
    raise exception 'Formulário não encontrado.' using errcode = 'P0002';
  end if;
  probs := hub.form_problemas(f);
  if array_length(probs, 1) > 0 then
    return probs;
  end if;
  perform set_config('hub.publicando', 'sim', true);
  update hub.formularios set
    publicado = jsonb_build_object('titulo', f.titulo, 'descricao', f.descricao, 'modo', f.modo, 'tema', f.tema,
                                   'perguntas', f.perguntas, 'final', f.final),
    publicado_em = now()
  where id = f.id;
  perform set_config('hub.publicando', '', true);
  return '{}';
end;
$$;

create or replace function hub.form_despublicar(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not hub.pode(array['admin', 'estrategista', 'criador']) then
    raise exception 'Seu papel não permite tirar formulários do ar.' using errcode = '42501';
  end if;
  perform set_config('hub.publicando', 'sim', true);
  update hub.formularios set publicado = null, publicado_em = null where id = p_id and conta_id = hub.conta_atual();
  perform set_config('hub.publicando', '', true);
end;
$$;
revoke all on function hub.form_publicar(bigint), hub.form_despublicar(bigint) from public, anon;
grant execute on function hub.form_publicar(bigint), hub.form_despublicar(bigint) to authenticated, service_role;

-- ─── 5. Funções públicas (visitante sem login) ───────────────────────────────
-- IP do visitante, guardado só como hash (para limitar abuso sem guardar dado pessoal).
create or replace function hub.form_ip_hash(p_form bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(
    coalesce(split_part((current_setting('request.headers', true)::json ->> 'x-forwarded-for'), ',', 1), 'sem-ip')
    || ':' || p_form::text || ':hub-form', 'sha256'), 'hex')
$$;
revoke all on function hub.form_ip_hash(bigint) from public, anon, authenticated;

-- O formulário publicado (só o que o público precisa ver).
create or replace function hub.form_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('slug', f.slug) || f.publicado
  from hub.formularios f
  where f.slug = lower(btrim(p_slug)) and f.publicado is not null
$$;

-- Abre (ou retoma) a sessão do visitante. Conta a visita uma vez por sessão.
create or replace function hub.form_iniciar(p_slug text, p_sessao uuid, p_origem jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f hub.formularios%rowtype;
  r hub.formulario_respostas%rowtype;
  ip text;
  origem jsonb := '{}'::jsonb;
  k text;
begin
  select * into f from hub.formularios where slug = lower(btrim(p_slug)) and publicado is not null;
  if f.id is null or p_sessao is null then
    raise exception 'Formulário indisponível.' using errcode = 'P0002';
  end if;
  select * into r from hub.formulario_respostas where formulario_id = f.id and sessao = p_sessao;
  if r.id is not null then
    return jsonb_build_object('respostas', r.respostas, 'concluido', r.concluido_em is not null);
  end if;
  ip := hub.form_ip_hash(f.id);
  if (select count(*) from hub.formulario_respostas x where x.formulario_id = f.id and x.ip_hash = ip and x.iniciado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitas tentativas. Tente de novo mais tarde.' using errcode = '54000';
  end if;
  -- Só guarda utm_* e ref, com tamanho limitado.
  if jsonb_typeof(p_origem) = 'object' then
    for k in select jsonb_object_keys(p_origem) loop
      if k ~ '^(utm_(source|medium|campaign|content|term)|ref)$' and jsonb_typeof(p_origem->k) = 'string' then
        origem := origem || jsonb_build_object(k, left(p_origem->>k, 120));
      end if;
    end loop;
  end if;
  insert into hub.formulario_respostas (formulario_id, conta_id, sessao, ip_hash, origem)
  values (f.id, f.conta_id, p_sessao, ip, origem)
  on conflict (formulario_id, sessao) do nothing;
  update hub.formularios set visitas = visitas + 1 where id = f.id;
  return jsonb_build_object('respostas', '{}'::jsonb, 'concluido', false);
end;
$$;

-- Guarda só respostas de perguntas que existem, com tamanho limitado.
create or replace function hub.form_limpar_respostas(p_perguntas jsonb, p_respostas jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  out jsonb := '{}'::jsonb;
  q jsonb;
  v jsonb;
begin
  if jsonb_typeof(p_respostas) is distinct from 'object' then return out; end if;
  for q in select value from jsonb_array_elements(p_perguntas) loop
    v := p_respostas -> (q->>'id');
    if v is null or jsonb_typeof(v) = 'null' then continue; end if;
    if jsonb_typeof(v) = 'array' then
      v := (select coalesce(jsonb_agg(left(x, 300)), '[]'::jsonb) from (select x from jsonb_array_elements_text(v) x limit 30) s);
    elsif jsonb_typeof(v) in ('string', 'number', 'boolean') then
      v := to_jsonb(left(v #>> '{}', 3000));
    else
      continue;
    end if;
    out := out || jsonb_build_object(q->>'id', v);
  end loop;
  return out;
end;
$$;
revoke all on function hub.form_limpar_respostas(jsonb, jsonb) from public, anon, authenticated;

create or replace function hub.form_salvar(p_slug text, p_sessao uuid, p_respostas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f hub.formularios%rowtype;
begin
  if length(p_respostas::text) > 100000 then
    raise exception 'Respostas grandes demais.' using errcode = '54000';
  end if;
  select * into f from hub.formularios where slug = lower(btrim(p_slug)) and publicado is not null;
  if f.id is null then
    raise exception 'Formulário indisponível.' using errcode = 'P0002';
  end if;
  update hub.formulario_respostas
  set respostas = hub.form_limpar_respostas(f.publicado->'perguntas', p_respostas), atualizado_em = now()
  where formulario_id = f.id and sessao = p_sessao and concluido_em is null;
end;
$$;

-- Envio final: valida as obrigatórias visíveis, cria ou atualiza o lead no funil e devolve a tela de obrigado.
create or replace function hub.form_concluir(p_slug text, p_sessao uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f      hub.formularios%rowtype;
  r      hub.formulario_respostas%rowtype;
  resp   jsonb;
  pergs  jsonb;
  q      jsonb;
  v      text;
  faltam text[] := '{}';
  qualif boolean := null;
  q_ok   boolean;
  v_handle text; v_nome text; v_email text; v_tel text;
  lead   hub.leads%rowtype;
  status text;
  erro   text;
  resumo text := '';
  etiq   text;
begin
  if length(p_respostas::text) > 100000 then
    raise exception 'Respostas grandes demais.' using errcode = '54000';
  end if;
  select * into f from hub.formularios where slug = lower(btrim(p_slug)) and publicado is not null;
  if f.id is null then
    raise exception 'Formulário indisponível.' using errcode = 'P0002';
  end if;
  select * into r from hub.formulario_respostas where formulario_id = f.id and sessao = p_sessao for update;
  if r.id is null then
    raise exception 'Sessão não encontrada. Recarregue a página.' using errcode = 'P0002';
  end if;
  if r.concluido_em is not null then
    return jsonb_build_object('ok', true, 'final', f.publicado->'final');
  end if;
  pergs := f.publicado->'perguntas';
  resp := hub.form_limpar_respostas(pergs, p_respostas);

  for q in select value from jsonb_array_elements(pergs) loop
    continue when q->>'tipo' in ('boas_vindas', 'mensagem') or not hub.form_visivel(q, resp);
    v := hub.form_texto(resp -> (q->>'id'));
    if (q->>'obrigatoria')::boolean is true and (v is null or (q->>'tipo' = 'termos' and v <> 'aceito')) then
      faltam := faltam || coalesce(q->>'titulo', 'pergunta');
    end if;
    if v is not null then
      case q->>'tipo'
        when 'instagram' then v_handle := coalesce(v_handle, lower(regexp_replace(regexp_replace(split_part(regexp_replace(v, '^https?://(www\.)?instagram\.com/', '', 'i'), '/', 1), '[?#].*$', ''), '^@', '')));
        when 'nome' then v_nome := coalesce(v_nome, left(v, 120));
        when 'email' then v_email := coalesce(v_email, lower(left(v, 200)));
        when 'telefone' then v_tel := coalesce(v_tel, left(v, 30));
        else null;
      end case;
      if q->>'tipo' <> 'termos' then
        resumo := resumo || E'\n• ' || coalesce(q->>'titulo', 'Pergunta') || ': ' || left(v, 300);
      end if;
    end if;
    -- Qualificação: a resposta precisa ter ao menos uma opção marcada como "qualifica".
    if (q->'qualificacao'->>'ativa')::boolean is true and v is not null then
      select bool_or((q->'qualificacao'->'qualifica'->>(o.i - 1)::int)::boolean)
      into q_ok
      from jsonb_array_elements_text(q->'opcoes') with ordinality o(txt, i)
      where o.txt = any (case when jsonb_typeof(resp->(q->>'id')) = 'array'
                              then array(select jsonb_array_elements_text(resp->(q->>'id')))
                              else array[v] end);
      qualif := coalesce(qualif, true) and coalesce(q_ok, false);
    end if;
  end loop;

  if array_length(faltam, 1) > 0 then
    return jsonb_build_object('ok', false, 'erro', 'Responda: ' || array_to_string(faltam, ', ') || '.');
  end if;
  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'erro', 'Confira o e-mail.');
  end if;

  -- Lead no funil.
  if f.pipeline_id is null or f.etapa_id is null then
    status := 'sem_funil';
  elsif v_handle is null or v_handle !~ '^[a-z0-9._]{1,30}$' then
    status := 'erro';
    erro := 'O @ do Instagram informado não é válido.';
  else
    etiq := coalesce(nullif(btrim(f.etiqueta), ''), left(f.titulo, 40));
    begin
      select * into lead from hub.leads where conta_id = f.conta_id and hub.leads.handle = v_handle for update;
      if lead.id is null then
        insert into hub.leads (conta_id, pipeline_id, etapa_id, perfil_id, handle, nome, telefone, email, responsavel, tags)
        values (f.conta_id, f.pipeline_id, f.etapa_id, f.perfil_id, v_handle, v_nome, v_tel, v_email, f.responsavel,
                array_remove(array[etiq, case qualif when true then 'qualificado' when false then 'não qualificado' end], null))
        returning * into lead;
        status := 'criado';
      else
        -- Já existe: completa o que faltava e marca a etiqueta, sem mudar a etapa nem o responsável.
        update hub.leads set
          nome = coalesce(hub.leads.nome, v_nome),
          telefone = coalesce(hub.leads.telefone, v_tel),
          email = coalesce(hub.leads.email, v_email),
          tags = (select array_agg(distinct t) from unnest(tags || array_remove(array[etiq, case qualif when true then 'qualificado' when false then 'não qualificado' end], null)) t)
        where id = lead.id;
        status := 'existente';
      end if;
      insert into hub.lead_eventos (lead_id, conta_id, tipo, para, detalhe, autor_nome)
      values (lead.id, f.conta_id, 'formulario', f.titulo, case status when 'criado' then 'entrou' else 'respondeu' end, 'Formulário');
      insert into hub.lead_notas (lead_id, texto, autor_nome)
      values (lead.id, left('Respondeu o formulário "' || f.titulo || '"' ||
                            case qualif when true then ' (qualificado)' when false then ' (não qualificado)' else '' end || ':' || resumo, 2000), 'Formulário');
      if status = 'criado' and f.responsavel is not null then
        insert into hub.alertas (conta_id, perfil_id, tipo, mensagem, chave, severidade, link, destinatario)
        values (f.conta_id, null, 'lead_formulario', format('Novo lead @%s pelo formulário "%s".', v_handle, f.titulo),
                'form:' || r.id, 'info', '/leads?lead=' || lead.id, f.responsavel)
        on conflict do nothing;
      end if;
    exception when others then
      status := 'erro';
      erro := left(sqlerrm, 300);
      lead := null;
    end;
  end if;

  update hub.formulario_respostas
  set respostas = resp, concluido_em = now(), atualizado_em = now(), qualificado = qualif,
      lead_id = lead.id, lead_status = status, lead_erro = erro
  where id = r.id;
  return jsonb_build_object('ok', true, 'final', f.publicado->'final');
end;
$$;

revoke all on function hub.form_publico(text), hub.form_iniciar(text, uuid, jsonb), hub.form_salvar(text, uuid, jsonb), hub.form_concluir(text, uuid, jsonb) from public;
grant execute on function hub.form_publico(text), hub.form_iniciar(text, uuid, jsonb), hub.form_salvar(text, uuid, jsonb), hub.form_concluir(text, uuid, jsonb)
  to anon, authenticated, service_role;
