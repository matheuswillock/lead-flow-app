-- Time-bounded, team-scoped billing grace. Subscription state and Asaas are
-- intentionally untouched; the access gate evaluates expiresAt on every decision.
CREATE TABLE IF NOT EXISTS "public"."billing_access_graces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedByProfileId" UUID,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "resolvedReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_access_graces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "billing_access_graces_team_active_expires_idx"
    ON "public"."billing_access_graces" ("teamId", "isActive", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_access_graces_teamId_fkey'
  ) THEN
    ALTER TABLE "public"."billing_access_graces"
      ADD CONSTRAINT "billing_access_graces_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
