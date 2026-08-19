-- Corrige `type` divergente do `mappingKey` em perguntas de formulário público
-- existentes, achado via auditoria de produção (MCP Supabase, 2026-08-19):
--   - 7 perguntas mappingKey=email tipadas como type=text
--     (sem teclado de e-mail no mobile, sem token de autocomplete nativo)
--   - 1 pergunta mappingKey=phone tipada como type=email
--     (provável erro de configuração)
-- Necessário pra Fase A do plano "Radar em tempo real — Autocomplete, cookies
-- e onBlur": o resolver de autocomplete deriva token do `mappingKey`, mas o
-- `type` errado ainda quebra o teclado/validação nativa do browser.
-- Idempotente — condição no WHERE evita reaplicar em cima de dados já corretos.

UPDATE "public"."corretor_studio_public_form_questions"
SET "type" = 'email', "updatedAt" = now()
WHERE "mappingTarget" = 'native_field'
  AND "mappingKey" = 'email'
  AND "type" <> 'email';

UPDATE "public"."corretor_studio_public_form_questions"
SET "type" = 'phone', "updatedAt" = now()
WHERE "mappingTarget" = 'native_field'
  AND "mappingKey" = 'phone'
  AND "type" <> 'phone';
