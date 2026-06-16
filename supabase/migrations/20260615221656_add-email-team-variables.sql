-- Global team-level email variables, usable in any email template ({{key}} syntax).

CREATE TABLE IF NOT EXISTS "public"."email_team_variables" (
  "id"           uuid NOT NULL DEFAULT gen_random_uuid(),
  "teamId"       uuid NOT NULL,
  "key"          text NOT NULL,
  "type"         text NOT NULL DEFAULT 'string',
  "defaultValue" text,
  "description"  text,
  "isActive"     boolean NOT NULL DEFAULT true,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "email_team_variables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_team_variables_teamId_fkey" FOREIGN KEY ("teamId")
    REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_team_variables_teamId_key_key"
  ON "public"."email_team_variables" ("teamId", "key");

CREATE INDEX IF NOT EXISTS "email_team_variables_teamId_isActive_idx"
  ON "public"."email_team_variables" ("teamId", "isActive");
