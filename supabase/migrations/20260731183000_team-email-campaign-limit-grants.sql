CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_email_campaign_limit_grants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "maxEmailsPerDay" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_key" UNIQUE ("teamId"),
  CONSTRAINT "corretor_studio_team_email_campaign_limit_grants_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "team_email_campaign_limit_grants_is_active_idx"
  ON "public"."corretor_studio_team_email_campaign_limit_grants" ("isActive");

INSERT INTO "public"."corretor_studio_team_email_campaign_limit_grants"
  ("id", "teamId", "maxEmailsPerDay", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  g."teamId",
  g."maxEmailsPerDay",
  g."isActive",
  g."createdAt",
  g."updatedAt"
FROM "public"."backoffice_team_email_limit_grants" g
ON CONFLICT ("teamId") DO UPDATE
SET
  "maxEmailsPerDay" = EXCLUDED."maxEmailsPerDay",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = EXCLUDED."updatedAt";

CREATE OR REPLACE FUNCTION "public"."sync_team_email_campaign_limit_grant_from_backoffice"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO "public"."corretor_studio_team_email_campaign_limit_grants"
    ("id", "teamId", "maxEmailsPerDay", "isActive", "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), NEW."teamId", NEW."maxEmailsPerDay", NEW."isActive", now(), now())
  ON CONFLICT ("teamId") DO UPDATE
  SET
    "maxEmailsPerDay" = EXCLUDED."maxEmailsPerDay",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "sync_team_email_campaign_limit_grant_from_backoffice"
  ON "public"."backoffice_team_email_limit_grants";

CREATE TRIGGER "sync_team_email_campaign_limit_grant_from_backoffice"
AFTER INSERT OR UPDATE ON "public"."backoffice_team_email_limit_grants"
FOR EACH ROW
EXECUTE FUNCTION "public"."sync_team_email_campaign_limit_grant_from_backoffice"();
