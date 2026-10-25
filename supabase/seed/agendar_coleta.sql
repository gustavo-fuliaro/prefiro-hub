-- Rode UMA vez no SQL Editor, depois de publicar a Edge Function coletar-perfis.
-- Troque SEU-PROJETO pelo ref do projeto e SEU_IG_USER_ID pelo id da conta Instagram Business
-- que faz as consultas (aparece no Graph API Explorer em me/accounts → instagram_business_account).

-- Segredo que o cron envia para a função (gerado aleatoriamente).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'hub_cron_secret', 'Prefiro Hub: autentica o cron da coleta')
where not exists (select 1 from vault.secrets where name = 'hub_cron_secret');

select vault.create_secret('SEU_IG_USER_ID', 'meta_ig_user_id', 'Prefiro Hub: conta Instagram que faz o Business Discovery')
where not exists (select 1 from vault.secrets where name = 'meta_ig_user_id');

-- O token da Meta (meta_access_token) é cadastrado por você em Integrations › Vault.

-- Coleta todo dia às 06:00 de Brasília (09:00 UTC).
select cron.schedule(
  'hub-coleta-diaria',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/coletar-perfis',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'hub_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
