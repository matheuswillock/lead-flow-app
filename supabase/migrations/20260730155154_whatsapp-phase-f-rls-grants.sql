-- Phase F: RLS + REVOKE + GRANT para tabelas whatsapp_* sem proteção
-- Padrão: mesma abordagem de 20260728043745_whatsapp-inbox-v3-phase-4-actions.sql
-- Acesso a essas tabelas é sempre server-side (service_role via API routes).

-- ============================================================
-- 1. team_whatsapp_configs
-- ============================================================
ALTER TABLE "public"."team_whatsapp_configs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."team_whatsapp_configs" FROM anon, authenticated;
GRANT ALL ON "public"."team_whatsapp_configs" TO service_role;

-- ============================================================
-- 2. team_whatsapp_contacts
-- ============================================================
ALTER TABLE "public"."team_whatsapp_contacts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."team_whatsapp_contacts" FROM anon, authenticated;
GRANT ALL ON "public"."team_whatsapp_contacts" TO service_role;

-- ============================================================
-- 3. whatsapp_conversation_tags
-- ============================================================
ALTER TABLE "public"."whatsapp_conversation_tags" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."whatsapp_conversation_tags" FROM anon, authenticated;
GRANT ALL ON "public"."whatsapp_conversation_tags" TO service_role;

-- ============================================================
-- 4. whatsapp_conversation_tag_assignments
-- ============================================================
ALTER TABLE "public"."whatsapp_conversation_tag_assignments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."whatsapp_conversation_tag_assignments" FROM anon, authenticated;
GRANT ALL ON "public"."whatsapp_conversation_tag_assignments" TO service_role;

-- ============================================================
-- 5. whatsapp_usage_events
-- ============================================================
ALTER TABLE "public"."whatsapp_usage_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."whatsapp_usage_events" FROM anon, authenticated;
GRANT ALL ON "public"."whatsapp_usage_events" TO service_role;

-- ============================================================
-- 6. whatsapp_send_rate_limit_windows
--    RLS já habilitado; adiciona REVOKE/GRANT ausentes.
-- ============================================================
REVOKE ALL ON "public"."whatsapp_send_rate_limit_windows" FROM anon, authenticated;
GRANT ALL ON "public"."whatsapp_send_rate_limit_windows" TO service_role;

-- ============================================================
-- 7. GRANT service_role explícito em tabelas operacionais
--    que têm REVOKE mas sem GRANT explícito:
--    whatsapp_contact_identities, whatsapp_outbound_commands,
--    whatsapp_sync_jobs, whatsapp_webhook_events
-- ============================================================
GRANT ALL ON "public"."whatsapp_contact_identities" TO service_role;
GRANT ALL ON "public"."whatsapp_outbound_commands" TO service_role;
GRANT ALL ON "public"."whatsapp_sync_jobs" TO service_role;
GRANT ALL ON "public"."whatsapp_webhook_events" TO service_role;

-- ============================================================
-- 8. Verificação da publication supabase_realtime
--    Apenas whatsapp_conversations e whatsapp_messages devem
--    estar publicadas (já adicionadas em migrações anteriores).
--    As demais tabelas NÃO devem ser incluídas.
-- ============================================================
-- Nenhuma ação necessária: publication já está correta.
-- As adições foram feitas em 20260702111737 e 20260723190331.
