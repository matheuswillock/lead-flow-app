-- T2 / US estabilizar pool: índices FK standalone nas tabelas quentes.
-- Espelham os @@index adicionados em prisma/schema.prisma.
--
-- Decisão CONCURRENTLY:
-- O runner do Supabase CLI aplica cada arquivo de migration dentro de uma
-- transação implícita. CREATE INDEX CONCURRENTLY não pode rodar em
-- transação, então usamos CREATE INDEX IF NOT EXISTS (padrão já adotado
-- em migrations de performance deste repositório, ex. 20260702160554).
-- Em produção com volume alto, se o lock de escrita for problema operacional,
-- aplicar o equivalente CONCURRENTLY via SQL Editor fora do pipeline e
-- reconciliar o histórico — não é necessário para o volume atual esperado.

-- PublicFormMetricEvent.questionId (FK sem índice standalone)
CREATE INDEX IF NOT EXISTS "corretor_studio_public_form_metric_events_questionId_idx"
  ON "public"."corretor_studio_public_form_metric_events" ("questionId");

-- EmailLog.dispatchId (existe composto [campaignId, dispatchId], mas não cobre lookups só por dispatchId)
CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_dispatchId_idx"
  ON "public"."corretor_studio_email_logs" ("dispatchId");

-- EmailContactRadarSyncOutbox.teamId (FK sem índice standalone)
CREATE INDEX IF NOT EXISTS "corretor_studio_email_contact_radar_sync_outbox_teamId_idx"
  ON "public"."corretor_studio_email_contact_radar_sync_outbox" ("teamId");
