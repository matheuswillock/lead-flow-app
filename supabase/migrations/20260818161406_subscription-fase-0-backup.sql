-- Fase 0 (A1 + A2): snapshot append-only do estado de assinatura + evento tipado
-- na timeline existente. Arquivo originado de `db:migrate:from-prisma`; SQL
-- reduzido ao delta desta entrega (o diff bruto trazia drift irrelevante).

DO $$ BEGIN
  CREATE TYPE "public"."subscription_lifecycle_event" AS ENUM (
    'contracted',
    'renewed',
    'plan_changed',
    'addon_purchased',
    'overdue',
    'reduced',
    'cut',
    'restored',
    'free_access_granted',
    'level_transition'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."corretor_studio_subscription_change_logs"
  ADD COLUMN IF NOT EXISTS "eventType" "public"."subscription_lifecycle_event";

UPDATE "public"."corretor_studio_subscription_change_logs"
SET "eventType" = "changeType"::"public"."subscription_lifecycle_event"
WHERE "eventType" IS NULL
  AND "changeType" IN (
    'contracted',
    'renewed',
    'plan_changed',
    'addon_purchased',
    'overdue',
    'reduced',
    'cut',
    'restored',
    'free_access_granted',
    'level_transition'
  );

CREATE INDEX IF NOT EXISTS "subscription_change_logs_event_type_idx"
  ON "public"."corretor_studio_subscription_change_logs" ("eventType");

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_subscription_state_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE RESTRICT,
  "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "schemaVersion" TEXT NOT NULL,
  "payload" JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS "subscription_state_snapshots_profile_id_idx"
  ON "public"."corretor_studio_subscription_state_snapshots" ("profileId");

CREATE INDEX IF NOT EXISTS "subscription_state_snapshots_captured_at_idx"
  ON "public"."corretor_studio_subscription_state_snapshots" ("capturedAt");

ALTER TABLE "public"."corretor_studio_subscription_state_snapshots" ENABLE ROW LEVEL SECURITY;
