-- Estágio 10 (D10): desconto % por adesão + aprovação.

ALTER TABLE "public"."backoffice_adhesions"
  ADD COLUMN IF NOT EXISTS "discountPercent" NUMERIC(5, 2) NULL,
  ADD COLUMN IF NOT EXISTS "discountStatus" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "discountApprovedByProfileId" UUID NULL,
  ADD COLUMN IF NOT EXISTS "discountApprovedAt" TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS "negotiatedTotalAmount" NUMERIC(12, 2) NULL;

DO $$ BEGIN
  ALTER TABLE "public"."backoffice_adhesions"
    ADD CONSTRAINT "backoffice_adhesions_discount_approved_by_fkey"
    FOREIGN KEY ("discountApprovedByProfileId")
    REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
