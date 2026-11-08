-- Prefiro Hub · Formulários: ajustes depois do teste.
-- 1) O contador de visitas não subia (a proteção do formulário também travava o campo).
-- 2) Quem responde de novo fica só com a qualificação mais recente (antes ficava "qualificado" e "não qualificado").

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
    -- Visitas só sobem pela função pública (hub.contando).
    if current_setting('hub.contando', true) is distinct from 'sim' then
      new.visitas := old.visitas;
    end if;
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
  perform set_config('hub.contando', 'sim', true);
  update hub.formularios set visitas = visitas + 1 where id = f.id;
  perform set_config('hub.contando', '', true);
  return jsonb_build_object('respostas', '{}'::jsonb, 'concluido', false);
end;
$$;

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
          -- A qualificação mais recente substitui a anterior.
          tags = (select array_agg(distinct t) from unnest(array_remove(array_remove(tags, case when qualif is null then null else 'qualificado' end), case when qualif is null then null else 'não qualificado' end) || array_remove(array[etiq, case qualif when true then 'qualificado' when false then 'não qualificado' end], null)) t)
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
revoke all on function hub.form_iniciar(text, uuid, jsonb), hub.form_concluir(text, uuid, jsonb) from public;
grant execute on function hub.form_iniciar(text, uuid, jsonb), hub.form_concluir(text, uuid, jsonb) to anon, authenticated, service_role;
