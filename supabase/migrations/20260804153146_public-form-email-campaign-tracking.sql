-- Habilita atribuição e-mail→formulário (cs_el = EmailLog.id) em formulários existentes.
-- Espelha prisma/schema.prisma: PublicForm.emailCampaignTrackingEnabled

ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "emailCampaignTrackingEnabled" boolean NOT NULL DEFAULT true;

-- Backfill idempotente: formulários já publicados/ativos entram no fluxo de resolução.
UPDATE "public"."corretor_studio_public_forms"
SET "emailCampaignTrackingEnabled" = true
WHERE "emailCampaignTrackingEnabled" IS DISTINCT FROM true;
