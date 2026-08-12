-- Email credit purchase support (Ticket 4), aligned with PlatformPurchase (Ticket 3)
-- - plano `upgrade` (25k / R$375) na precificação canônica
-- - grants idempotentes por paymentId Asaas
-- Compra pendente/paga: corretor_studio_platform_purchases (purchaseType=email_credits)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'email_credit_plan'
      AND e.enumlabel = 'upgrade'
  ) THEN
    ALTER TYPE "public"."email_credit_plan" ADD VALUE 'upgrade';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_email_credit_payment_grants" (
  "id" uuid NOT NULL,
  "teamId" uuid NOT NULL,
  "plan" "public"."email_credit_plan" NOT NULL,
  "paymentId" text NOT NULL,
  "checkoutId" text,
  "monthlyCredits" integer NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_email_credit_payment_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_credit_payment_grants_paymentId_key"
  ON "public"."corretor_studio_email_credit_payment_grants" ("paymentId");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_credit_payment_grants_teamId_idx"
  ON "public"."corretor_studio_email_credit_payment_grants" ("teamId");
