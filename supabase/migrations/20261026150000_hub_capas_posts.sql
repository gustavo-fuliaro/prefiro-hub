-- Prefiro Hub · Capas dos posts.
-- Bug: a coleta gravava os posts em lote com a coluna thumb_path só em parte das linhas; o banco
-- completava as outras com null e apagava capas já salvas. As imagens continuavam no Storage.

-- 1. Recupera as capas que já estão no Storage (caminho: <handle>/posts/<media_id>.jpg).
update hub.posts p
set thumb_path = f.handle || '/posts/' || p.media_id || '.jpg'
from hub.perfis f
where f.id = p.perfil_id
  and p.thumb_path is null
  and exists (
    select 1 from storage.objects o
    where o.bucket_id = 'hub-midia' and o.name = f.handle || '/posts/' || p.media_id || '.jpg'
  );

-- 2. Trava: uma capa salva nunca volta a ser null por uma atualização (só muda para outra capa).
create or replace function hub.manter_capa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.thumb_path is null and old.thumb_path is not null then
    new.thumb_path := old.thumb_path;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_manter_capa on hub.posts;
create trigger posts_manter_capa before update on hub.posts
  for each row execute function hub.manter_capa();
