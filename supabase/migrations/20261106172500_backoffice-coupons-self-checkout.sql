-- Cupons de desconto do auto-checkout (módulo backoffice) e registro do cupom usado na adesão.
-- Idempotente: pode ser reexecutada sem efeito colateral.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_coupon_discount_type') THEN
    CREATE TYPE "public"."backoffice_coupon_discount_type" AS ENUM ('percent', 'fixed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."backoffice_coupons" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "discountType" "public"."backoffice_coupon_discount_type" NOT NULL,
  "discountValue" numeric(12, 2) NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "validFrom" timestamptz(6),
  "validUntil" timestamptz(6),
  "maxUses" integer,
  "usesCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_coupons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_coupons_discount_value_positive" CHECK ("discountValue" > 0),
  CONSTRAINT "backoffice_coupons_percent_max" CHECK ("discountType" <> 'percent' OR "discountValue" < 100),
  CONSTRAINT "backoffice_coupons_max_uses_positive" CHECK ("maxUses" IS NULL OR "maxUses" > 0),
  CONSTRAINT "backoffice_coupons_uses_count_non_negative" CHECK ("usesCount" >= 0),
  CONSTRAINT "backoffice_coupons_code_normalized" CHECK ("code" = upper(btrim("code")) AND "code" <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_coupons_code_key"
  ON "public"."backoffice_coupons" ("code");

ALTER TABLE "public"."backoffice_coupons" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "couponId" uuid,
  ADD COLUMN IF NOT EXISTS "couponCode" text,
  ADD COLUMN IF NOT EXISTS "couponDiscountType" "public"."backoffice_coupon_discount_type",
  ADD COLUMN IF NOT EXISTS "couponDiscountValue" numeric(12, 2),
  ADD COLUMN IF NOT EXISTS "couponDiscountAmount" numeric(12, 2),
  -- Auto-checkout: valor ÚNICO dos adicionais (usuário/time) para o período inteiro. Quando preenchido,
  -- substitui "monthlyExtra*Amount" x meses no total da adesão (nulo = cálculo mensal do cadastro administrativo).
  ADD COLUMN IF NOT EXISTS "extrasTotalAmount" numeric(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_adhesions_coupon_id_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_adhesions"
      ADD CONSTRAINT "backoffice_adhesions_coupon_id_fkey"
      FOREIGN KEY ("couponId") REFERENCES "public"."backoffice_coupons" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "backoffice_adhesions_coupon_id_idx"
  ON "public"."backoffice_adhesions" ("couponId");
