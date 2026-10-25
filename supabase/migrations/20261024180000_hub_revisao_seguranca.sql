-- Prefiro Hub · revisão de segurança da Fase 5.
-- As funções de papel só fazem sentido com usuário logado; tira o acesso de visitantes (anon).
revoke execute on function hub.papel_atual() from public, anon;
revoke execute on function hub.pode(text[]) from public, anon;
grant execute on function hub.papel_atual(), hub.pode(text[]) to authenticated, service_role;
