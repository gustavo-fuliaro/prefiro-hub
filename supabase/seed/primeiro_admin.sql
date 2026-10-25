-- Rode UMA vez no SQL Editor do Supabase depois de criar seu usuário em Authentication > Users.
-- Troque o e-mail e o nome abaixo.
insert into hub.membros (user_id, nome, papel)
select id, 'Seu nome', 'admin'
from auth.users
where email = 'seu-email@exemplo.com'
on conflict (user_id) do update set papel = 'admin';
