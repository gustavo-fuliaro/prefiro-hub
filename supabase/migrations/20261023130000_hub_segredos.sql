-- Leitura de segredos do Vault pela Edge Function de coleta.
-- Só o service role executa, e só os nomes listados podem ser lidos.
create or replace function hub.segredo(nome text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = nome
    and nome in ('meta_access_token', 'meta_ig_user_id', 'hub_cron_secret')
  limit 1
$$;

revoke all on function hub.segredo(text) from public, anon, authenticated;
grant execute on function hub.segredo(text) to service_role;
