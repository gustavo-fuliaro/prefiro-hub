-- Rode UMA vez no SQL Editor, depois da migração da Fase 5.
-- Gera o relatório da semana anterior toda segunda às 08:00 de Brasília (11:00 UTC).
select cron.schedule('hub-relatorio-semanal', '0 11 * * 1', $$select hub.gerar_relatorio_semanal()$$);
