-- D9: motivo de falha por disparo individual (campanha + dispatch)

ALTER TABLE "public"."corretor_studio_email_campaign_dispatches"
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
