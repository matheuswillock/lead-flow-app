-- Backoffice whitelist: custom or unlimited daily email dispatch limits per team
CREATE TABLE IF NOT EXISTS "public"."backoffice_team_email_limit_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "maxEmailsPerDay" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "grantedByProfileId" UUID NOT NULL,
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "revokedByProfileId" UUID,
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_team_email_limit_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_team_email_limit_grants_teamId_key" UNIQUE ("teamId"),
  CONSTRAINT "backoffice_team_email_limit_grants_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "backoffice_team_email_limit_grants_grantedByProfileId_fkey"
    FOREIGN KEY ("grantedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "backoffice_team_email_limit_grants_revokedByProfileId_fkey"
    FOREIGN KEY ("revokedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "backoffice_team_email_limit_grants_is_active_idx"
  ON "public"."backoffice_team_email_limit_grants" ("isActive");

ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'EMAIL_CAMPAIGN_DISPATCH_FAILED';
