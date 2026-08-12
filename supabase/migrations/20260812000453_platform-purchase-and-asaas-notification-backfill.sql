-- PlatformPurchase + Asaas notification backfill state
-- Physical names from prisma @@map / @map only.

DO $$ BEGIN
  CREATE TYPE "public"."platform_purchase_type" AS ENUM (
    'email_credits',
    'feature_addon',
    'radar_self_service',
    'radar_managed',
    'subscription_capacity'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."platform_purchase_status" AS ENUM (
    'pending',
    'awaiting_payment',
    'paid',
    'failed',
    'canceled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."asaas_notification_backfill_status" AS ENUM (
    'pending',
    'completed',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_platform_purchases" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" uuid NOT NULL,
  "team_id" uuid,
  "product_slug" text NOT NULL,
  "purchase_type" "public"."platform_purchase_type" NOT NULL,
  "status" "public"."platform_purchase_status" NOT NULL DEFAULT 'pending',
  "billing_type" text,
  "amount" numeric(12, 2) NOT NULL,
  "quantity" integer,
  "description" text,
  "metadata" jsonb,
  "asaas_payment_id" text,
  "asaas_customer_id" text,
  "external_reference" text NOT NULL,
  "paid_at" timestamptz(6),
  "applied_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_platform_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_platform_purchases_external_reference_key"
  ON "public"."corretor_studio_platform_purchases" ("external_reference");

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_platform_purchases_asaas_payment_id_key"
  ON "public"."corretor_studio_platform_purchases" ("asaas_payment_id");

CREATE INDEX IF NOT EXISTS "corretor_studio_platform_purchases_profile_status_idx"
  ON "public"."corretor_studio_platform_purchases" ("profile_id", "status");

CREATE INDEX IF NOT EXISTS "corretor_studio_platform_purchases_product_slug_idx"
  ON "public"."corretor_studio_platform_purchases" ("product_slug");

CREATE INDEX IF NOT EXISTS "corretor_studio_platform_purchases_purchase_type_idx"
  ON "public"."corretor_studio_platform_purchases" ("purchase_type");

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_platform_purchases"
    ADD CONSTRAINT "corretor_studio_platform_purchases_profile_id_fkey"
    FOREIGN KEY ("profile_id") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_platform_purchases"
    ADD CONSTRAINT "corretor_studio_platform_purchases_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_asaas_notification_backfill" (
  "asaas_customer_id" text NOT NULL,
  "status" "public"."asaas_notification_backfill_status" NOT NULL DEFAULT 'pending',
  "last_error" text,
  "completed_at" timestamptz(6),
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_asaas_notification_backfill_pkey" PRIMARY KEY ("asaas_customer_id")
);

CREATE INDEX IF NOT EXISTS "corretor_studio_asaas_notification_backfill_status_idx"
  ON "public"."corretor_studio_asaas_notification_backfill" ("status");
