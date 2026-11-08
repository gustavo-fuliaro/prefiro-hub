-- Prefiro Hub · Formulários: o lead é criado pelo sistema, nunca em nome de quem respondeu.
-- Se alguém da equipe logado responde o próprio formulário, o lead não deve ficar com essa pessoa:
-- o responsável é só o que o formulário define. O envio final passa a ser hub.form_enviar, que roda
-- sem identidade de usuário; hub.form_concluir vira interna (não é mais chamável de fora).
create or replace function hub.form_enviar(p_slug text, p_sessao uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return hub.form_concluir(p_slug, p_sessao, p_respostas);
end;
$$;
revoke all on function hub.form_enviar(text, uuid, jsonb) from public;
grant execute on function hub.form_enviar(text, uuid, jsonb) to anon, authenticated, service_role;
revoke execute on function hub.form_concluir(text, uuid, jsonb) from anon, authenticated;
