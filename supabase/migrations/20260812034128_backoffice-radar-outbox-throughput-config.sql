-- Vazão do outbox Radar D9: knobs operacionais editáveis no backoffice.
-- Sem linha ativa até o primeiro save; cron lê batchSize/concurrency a cada tick
-- com precedência: backoffice ativo → env → defaults do código.

CREATE TABLE IF NOT EXISTS "public"."backoffice_radar_outbox_throughput_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batchSize" INTEGER NOT NULL DEFAULT 250,
  "concurrency" INTEGER NOT NULL DEFAULT 8,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "updatedByProfileId" UUID NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_radar_outbox_throughput_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_radar_outbox_throughput_configs_batch_chk"
    CHECK ("batchSize" >= 1 AND "batchSize" <= 500),
  CONSTRAINT "backoffice_radar_outbox_throughput_configs_concurrency_chk"
    CHECK ("concurrency" >= 1 AND "concurrency" <= 16),
  CONSTRAINT "backoffice_radar_outbox_throughput_configs_updated_by_fkey"
    FOREIGN KEY ("updatedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "backoffice_radar_outbox_throughput_configs_isActive_idx"
  ON "public"."backoffice_radar_outbox_throughput_configs" ("isActive");

ALTER TABLE "public"."backoffice_radar_outbox_throughput_configs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all JWT on backoffice_radar_outbox_throughput_configs"
  ON "public"."backoffice_radar_outbox_throughput_configs";
CREATE POLICY "Deny all JWT on backoffice_radar_outbox_throughput_configs"
  ON "public"."backoffice_radar_outbox_throughput_configs"
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Sem seed ativo: até o primeiro save no backoffice, o cron continua em
-- env (RADAR_EMAIL_CONTACT_SYNC_OUTBOX_BATCH_SIZE / RADAR_SYNC_CONCURRENCY)
-- ou nos defaults do código. Seedar 250/8 ativo sobrescreveria throttles de env.
