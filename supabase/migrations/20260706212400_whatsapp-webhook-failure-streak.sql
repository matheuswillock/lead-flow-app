-- WhatsApp: contador de falhas consecutivas no webhook (alerta Sentry após N falhas)

ALTER TABLE "public"."team_whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "webhookConsecutiveFailures" INTEGER NOT NULL DEFAULT 0;
