-- Rode UMA vez no SQL Editor do Supabase depois de criar seu usuário em Authentication > Users.
-- Troque o nome da empresa, o seu nome e o e-mail abaixo.
-- Cria a conta (ambiente) da empresa e faz de você a conta administradora principal, que cadastra
-- os demais usuários pela aba Usuários do Hub.
with conta as (
  insert into hub.contas (nome) values ('Nome da sua empresa') returning id
)
insert into hub.membros (user_id, nome, papel, conta_id, super_admin)
select u.id, 'Seu nome', 'admin', conta.id, true
from auth.users u, conta
where u.email = 'seu-email@exemplo.com'
on conflict (user_id) do update set papel = 'admin', super_admin = true;
