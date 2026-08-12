-- Vazão do outbox Radar D9: knobs operacionais editáveis no backoffice.
-- Singleton ativo; cron sync-email-contacts lê batchSize/concurrency a cada tick.

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

-- Seed singleton (defaults alinhados ao T4) se ainda não houver linha ativa.
INSERT INTO "public"."backoffice_radar_outbox_throughput_configs"
  ("id", "batchSize", "concurrency", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 250, 8, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."backoffice_radar_outbox_throughput_configs" WHERE "isActive" = true
);
