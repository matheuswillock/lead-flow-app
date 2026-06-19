ALTER TABLE "public"."corretor_studio_email_templates"
  ADD COLUMN IF NOT EXISTS "versionGroupId" uuid,
  ADD COLUMN IF NOT EXISTS "versionNumber" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "isCurrentPublished" boolean NOT NULL DEFAULT false;

UPDATE "public"."corretor_studio_email_templates"
  SET
    "versionGroupId" = COALESCE("versionGroupId", "id"),
    "versionNumber" = COALESCE("versionNumber", 1),
    "isCurrentPublished" = ("status" = 'published')
  WHERE "versionGroupId" IS NULL;

ALTER TABLE "public"."corretor_studio_email_templates"
  ALTER COLUMN "versionGroupId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'corretor_studio_email_templates_versionGroupId_fkey'
  ) THEN
    ALTER TABLE "public"."corretor_studio_email_templates"
      ADD CONSTRAINT "corretor_studio_email_templates_versionGroupId_fkey"
      FOREIGN KEY ("versionGroupId")
      REFERENCES "public"."corretor_studio_email_templates"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "corretor_studio_email_templates_version_group_idx"
  ON "public"."corretor_studio_email_templates" ("teamId", "versionGroupId", "versionNumber");

CREATE INDEX IF NOT EXISTS "corretor_studio_email_templates_current_published_idx"
  ON "public"."corretor_studio_email_templates" ("teamId", "isCurrentPublished")
  WHERE "isCurrentPublished" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_templates_version_group_number_key"
  ON "public"."corretor_studio_email_templates" ("versionGroupId", "versionNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_email_templates_one_current_published_key"
  ON "public"."corretor_studio_email_templates" ("versionGroupId")
  WHERE "isCurrentPublished" = true;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_email_template_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "templateId" uuid NOT NULL,
  "teamId" uuid NOT NULL,
  "actorProfileId" uuid,
  "eventType" text NOT NULL,
  "description" text,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_email_template_history_templateId_fkey"
    FOREIGN KEY ("templateId")
    REFERENCES "public"."corretor_studio_email_templates"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_email_template_history_teamId_fkey"
    FOREIGN KEY ("teamId")
    REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_email_template_history_actorProfileId_fkey"
    FOREIGN KEY ("actorProfileId")
    REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "corretor_studio_email_template_history_templateId_createdAt_idx"
  ON "public"."corretor_studio_email_template_history" ("templateId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "corretor_studio_email_template_history_teamId_createdAt_idx"
  ON "public"."corretor_studio_email_template_history" ("teamId", "createdAt" DESC);
