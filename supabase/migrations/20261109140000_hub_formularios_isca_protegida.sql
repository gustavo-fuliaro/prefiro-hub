-- Prefiro Hub · Formulários: o link da isca só é entregue a quem envia o formulário.
-- Antes ele ia junto com o formulário público e podia ser lido sem responder.

create or replace function hub.form_publico(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('slug', f.slug)
         || (f.publicado - 'final')
         || jsonb_build_object('final', coalesce(f.publicado->'final', '{}'::jsonb) - 'link')
  from hub.formularios f
  where f.slug = lower(btrim(p_slug)) and f.publicado is not null
$$;
revoke all on function hub.form_publico(text) from public;
grant execute on function hub.form_publico(text) to anon, authenticated, service_role;

-- Quem já enviou e volta pelo mesmo navegador recebe a tela final completa (com o link).
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
    return jsonb_build_object('respostas', r.respostas, 'concluido', r.concluido_em is not null,
                              'final', case when r.concluido_em is not null then f.publicado->'final' end);
  end if;
  ip := hub.form_ip_hash(f.id);
  if (select count(*) from hub.formulario_respostas x where x.formulario_id = f.id and x.ip_hash = ip and x.iniciado_em > now() - interval '1 hour') >= 30 then
    raise exception 'Muitas tentativas. Tente de novo mais tarde.' using errcode = '54000';
  end if;
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
revoke all on function hub.form_iniciar(text, uuid, jsonb) from public;
grant execute on function hub.form_iniciar(text, uuid, jsonb) to anon, authenticated, service_role;
