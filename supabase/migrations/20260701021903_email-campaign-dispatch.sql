-- Email campaign dispatch tracking + template snapshot per send

DO $$ BEGIN
  CREATE TYPE "public"."email_campaign_dispatch_status" AS ENUM ('sending', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_email_campaign_dispatches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "dispatchNumber" INTEGER NOT NULL,
  "templateId" UUID NOT NULL,
  "templateVersionNumber" INTEGER NOT NULL,
  "templateName" TEXT NOT NULL,
  "templateSubject" TEXT NOT NULL,
  "templateHtml" TEXT NOT NULL,
  "contactListId" UUID,
  "contactListName" TEXT,
  "cdpSegmentSlug" TEXT,
  "dispatchedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "triggeredBy" UUID NOT NULL,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "totalSent" INTEGER NOT NULL DEFAULT 0,
  "totalDelivered" INTEGER NOT NULL DEFAULT 0,
  "totalOpened" INTEGER NOT NULL DEFAULT 0,
  "totalClicked" INTEGER NOT NULL DEFAULT 0,
  "totalBounced" INTEGER NOT NULL DEFAULT 0,
  "totalComplained" INTEGER NOT NULL DEFAULT 0,
  "status" "public"."email_campaign_dispatch_status" NOT NULL DEFAULT 'sending',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_email_campaign_dispatches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_email_campaign_dispatches_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "public"."corretor_studio_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_email_campaign_dispatches_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_email_campaign_dispatches_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "public"."corretor_studio_email_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_email_campaign_dispatches_contactListId_fkey"
    FOREIGN KEY ("contactListId") REFERENCES "public"."corretor_studio_email_contact_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_email_campaign_dispatches_triggeredBy_fkey"
    FOREIGN KEY ("triggeredBy") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_campaign_dispatches_campaignId_dispatchNumber_key"
  ON "public"."corretor_studio_email_campaign_dispatches"("campaignId", "dispatchNumber");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_campaign_dispatches_teamId_dispatchedAt_idx"
  ON "public"."corretor_studio_email_campaign_dispatches"("teamId", "dispatchedAt" DESC);

CREATE INDEX IF NOT EXISTS "corretor_studio_email_campaign_dispatches_campaignId_dispatchedAt_idx"
  ON "public"."corretor_studio_email_campaign_dispatches"("campaignId", "dispatchedAt" DESC);

ALTER TABLE "public"."corretor_studio_email_logs"
  ADD COLUMN IF NOT EXISTS "dispatchId" UUID;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_email_logs"
    ADD CONSTRAINT "corretor_studio_email_logs_dispatchId_fkey"
    FOREIGN KEY ("dispatchId") REFERENCES "public"."corretor_studio_email_campaign_dispatches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_campaignId_dispatchId_idx"
  ON "public"."corretor_studio_email_logs"("campaignId", "dispatchId");

-- Backfill synthetic dispatch #1 for campaigns already sent
INSERT INTO "public"."corretor_studio_email_campaign_dispatches" (
  "id",
  "campaignId",
  "teamId",
  "dispatchNumber",
  "templateId",
  "templateVersionNumber",
  "templateName",
  "templateSubject",
  "templateHtml",
  "contactListId",
  "contactListName",
  "cdpSegmentSlug",
  "dispatchedAt",
  "triggeredBy",
  "totalRecipients",
  "totalSent",
  "totalDelivered",
  "totalOpened",
  "totalClicked",
  "totalBounced",
  "totalComplained",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  c."id",
  c."teamId",
  1,
  c."templateId",
  COALESCE(t."versionNumber", 1),
  COALESCE(t."name", 'Template'),
  COALESCE(t."subject", ''),
  COALESCE(t."html", ''),
  c."contactListId",
  cl."name",
  c."cdpSegmentSlug",
  COALESCE(c."sentAt", c."updatedAt"),
  c."createdBy",
  c."totalRecipients",
  c."totalSent",
  c."totalDelivered",
  c."totalOpened",
  c."totalClicked",
  c."totalBounced",
  c."totalComplained",
  CASE WHEN c."status" = 'failed' THEN 'failed'::"public"."email_campaign_dispatch_status" ELSE 'completed'::"public"."email_campaign_dispatch_status" END,
  COALESCE(c."sentAt", c."createdAt"),
  COALESCE(c."sentAt", c."updatedAt")
FROM "public"."corretor_studio_email_campaigns" c
LEFT JOIN "public"."corretor_studio_email_templates" t ON t."id" = c."templateId"
LEFT JOIN "public"."corretor_studio_email_contact_lists" cl ON cl."id" = c."contactListId"
WHERE (c."dispatchCount" > 0 OR c."status" = 'sent')
  AND NOT EXISTS (
    SELECT 1 FROM "public"."corretor_studio_email_campaign_dispatches" d
    WHERE d."campaignId" = c."id"
  );

UPDATE "public"."corretor_studio_email_logs" l
SET "dispatchId" = d."id"
FROM "public"."corretor_studio_email_campaign_dispatches" d
WHERE l."campaignId" = d."campaignId"
  AND d."dispatchNumber" = 1
  AND l."dispatchId" IS NULL;
