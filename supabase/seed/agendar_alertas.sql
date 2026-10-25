-- Rode UMA vez no SQL Editor, depois da migração da Fase 2.
-- Gera os alertas todo dia às 06:20 de Brasília (09:20 UTC), 20 minutos depois da coleta.
select cron.schedule('hub-alertas-diarios', '20 9 * * *', $$select hub.gerar_alertas()$$);
