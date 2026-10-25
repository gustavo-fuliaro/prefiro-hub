-- Ajustes apontados pelo linter do Supabase após a migração inicial.

-- 1) Índices para as chaves estrangeiras.
create index if not exists alertas_perfil_idx     on hub.alertas (perfil_id);
create index if not exists ideias_post_idx        on hub.ideias (post_id);
create index if not exists materiais_ia_perfil_idx on hub.materiais_ia (perfil_id);
create index if not exists metas_perfil_idx       on hub.metas (perfil_id);
create index if not exists perfis_responsavel_idx on hub.perfis (responsavel);

-- 2) Políticas "for all" também valiam para SELECT, somando-se às de leitura.
--    Troca cada uma por políticas só de insert, update e delete.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('membros',        'membros_admin',          array['admin']),
      ('perfis',         'perfis_escrever',        array['admin','estrategista']),
      ('posicionamento', 'posicionamento_escrever', array['admin','estrategista']),
      ('metas',          'metas_escrever',         array['admin','estrategista']),
      ('ideias',         'ideias_escrever',        array['admin','estrategista','criador']),
      ('briefings',      'briefings_escrever',     array['admin','estrategista','criador']),
      ('materiais_ia',   'materiais_escrever',     array['admin','estrategista','criador'])
    ) as t(tabela, politica, papeis)
  loop
    execute format('drop policy if exists %I on hub.%I', r.politica, r.tabela);
    execute format('create policy %I on hub.%I for insert to authenticated with check (hub.pode(%L::text[]))',
                   r.politica || '_inserir', r.tabela, r.papeis);
    execute format('create policy %I on hub.%I for update to authenticated using (hub.pode(%L::text[])) with check (hub.pode(%L::text[]))',
                   r.politica || '_alterar', r.tabela, r.papeis, r.papeis);
    execute format('create policy %I on hub.%I for delete to authenticated using (hub.pode(%L::text[]))',
                   r.politica || '_excluir', r.tabela, r.papeis);
  end loop;
end $$;
