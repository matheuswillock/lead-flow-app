ALTER TABLE "public"."email_team_settings"
ADD COLUMN IF NOT EXISTS "templateApprovalRoles" TEXT[] NOT NULL DEFAULT ARRAY['manager', 'backoffice']::TEXT[];

ALTER TABLE "public"."email_team_settings"
ADD COLUMN IF NOT EXISTS "blockedDispatchDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

CREATE TABLE IF NOT EXISTS "public"."email_team_senders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "replyTo" TEXT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_team_senders_teamId_isDefault_idx"
ON "public"."email_team_senders" ("teamId", "isDefault");

INSERT INTO "public"."email_team_senders" ("teamId", "name", "email", "replyTo", "isDefault")
SELECT
  ets."teamId",
  ets."fromName",
  ets."fromEmail",
  ets."replyTo",
  TRUE
FROM "public"."email_team_settings" ets
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."email_team_senders" sender
  WHERE sender."teamId" = ets."teamId"
);

WITH ranked AS (
  SELECT
    sender."id",
    ROW_NUMBER() OVER (
      PARTITION BY sender."teamId"
      ORDER BY sender."isDefault" DESC, sender."createdAt" ASC, sender."id" ASC
    ) AS position
  FROM "public"."email_team_senders" sender
)
UPDATE "public"."email_team_senders" sender
SET "isDefault" = ranked.position = 1,
    "updatedAt" = now()
FROM ranked
WHERE ranked."id" = sender."id"
  AND sender."isDefault" IS DISTINCT FROM (ranked.position = 1);

UPDATE "public"."email_team_settings" ets
SET
  "fromName" = sender."name",
  "fromEmail" = sender."email",
  "replyTo" = sender."replyTo"
FROM "public"."email_team_senders" sender
WHERE sender."teamId" = ets."teamId"
  AND sender."isDefault" = TRUE
  AND (
    ets."fromName" IS DISTINCT FROM sender."name"
    OR ets."fromEmail" IS DISTINCT FROM sender."email"
    OR ets."replyTo" IS DISTINCT FROM sender."replyTo"
  );
