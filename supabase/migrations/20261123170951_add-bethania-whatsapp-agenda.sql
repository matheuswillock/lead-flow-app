-- Bethânia verification, controls, durable outbox and per-event audit.
ALTER TABLE "public"."corretor_studio_profiles"
  ADD COLUMN "whatsappPhone" TEXT,
  ADD COLUMN "whatsappPhoneVerifiedAt" TIMESTAMPTZ(6);

CREATE TYPE "public"."BethaniaOutboxStatus" AS ENUM (
  'pending',
  'sending',
  'sent',
  'failed',
  'suppressed'
);

CREATE TABLE "public"."bethania_verification_challenges" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bethania_verification_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bethania_verification_challenges_attempts_check" CHECK ("attempts" >= 0)
);
CREATE INDEX "bethania_verification_challenges_profileId_createdAt_idx"
  ON "public"."bethania_verification_challenges"("profileId", "createdAt" DESC);
CREATE INDEX "bethania_verification_challenges_phone_createdAt_idx"
  ON "public"."bethania_verification_challenges"("phone", "createdAt" DESC);
ALTER TABLE "public"."bethania_verification_challenges"
  ADD CONSTRAINT "bethania_verification_challenges_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."bethania_global_controls" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "updatedByProfileId" UUID,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "bethania_global_controls_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."bethania_global_controls"
  ADD CONSTRAINT "bethania_global_controls_updatedByProfileId_fkey"
  FOREIGN KEY ("updatedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."bethania_event_controls" (
  "eventType" TEXT NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "updatedByProfileId" UUID,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "bethania_event_controls_pkey" PRIMARY KEY ("eventType")
);
ALTER TABLE "public"."bethania_event_controls"
  ADD CONSTRAINT "bethania_event_controls_updatedByProfileId_fkey"
  FOREIGN KEY ("updatedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."bethania_sender_configs" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "webhookUrl" TEXT NOT NULL,
  "updatedByProfileId" UUID,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "bethania_sender_configs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."bethania_sender_configs"
  ADD CONSTRAINT "bethania_sender_configs_updatedByProfileId_fkey"
  FOREIGN KEY ("updatedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."bethania_outbox" (
  "id" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "profileId" UUID NOT NULL,
  "phone" TEXT,
  "message" TEXT,
  "status" "public"."BethaniaOutboxStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMPTZ(6),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMPTZ(6),
  CONSTRAINT "bethania_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bethania_outbox_attempts_check" CHECK ("attempts" >= 0)
);
CREATE UNIQUE INDEX "bethania_outbox_idempotencyKey_key"
  ON "public"."bethania_outbox"("idempotencyKey");
CREATE INDEX "bethania_outbox_status_nextAttemptAt_idx"
  ON "public"."bethania_outbox"("status", "nextAttemptAt");
CREATE INDEX "bethania_outbox_profileId_eventType_createdAt_idx"
  ON "public"."bethania_outbox"("profileId", "eventType", "createdAt" DESC);
ALTER TABLE "public"."bethania_outbox"
  ADD CONSTRAINT "bethania_outbox_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "public"."corretor_studio_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."bethania_delivery_logs" (
  "id" UUID NOT NULL,
  "outboxId" UUID,
  "recipientProfileId" UUID,
  "eventType" TEXT NOT NULL,
  "status" "public"."BethaniaOutboxStatus" NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bethania_delivery_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bethania_delivery_logs_eventType_createdAt_idx"
  ON "public"."bethania_delivery_logs"("eventType", "createdAt" DESC);
CREATE INDEX "bethania_delivery_logs_status_createdAt_idx"
  ON "public"."bethania_delivery_logs"("status", "createdAt" DESC);
CREATE INDEX "bethania_delivery_logs_recipientProfileId_createdAt_idx"
  ON "public"."bethania_delivery_logs"("recipientProfileId", "createdAt" DESC);
ALTER TABLE "public"."bethania_delivery_logs"
  ADD CONSTRAINT "bethania_delivery_logs_outboxId_fkey"
  FOREIGN KEY ("outboxId") REFERENCES "public"."bethania_outbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."bethania_delivery_logs"
  ADD CONSTRAINT "bethania_delivery_logs_recipientProfileId_fkey"
  FOREIGN KEY ("recipientProfileId") REFERENCES "public"."corretor_studio_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."bethania_verification_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bethania_global_controls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bethania_event_controls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bethania_sender_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bethania_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bethania_delivery_logs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "public"."bethania_verification_challenges",
  "public"."bethania_global_controls",
  "public"."bethania_event_controls",
  "public"."bethania_sender_configs",
  "public"."bethania_outbox",
  "public"."bethania_delivery_logs"
FROM anon, authenticated;
