-- D8: Pixel tracking — add visitor_session identity type, pixel_hit source type, and two new tables

ALTER TYPE "public"."radar_identity_type" ADD VALUE IF NOT EXISTS 'visitor_session';
ALTER TYPE "public"."radar_source_type" ADD VALUE IF NOT EXISTS 'pixel_hit';

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_radar_pixel_configs" (
  "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  "teamId"             UUID        NOT NULL,
  "publicToken"        TEXT        NOT NULL,
  "allowedOrigins"     TEXT[]      NOT NULL DEFAULT '{}',
  "lastUsedAt"         TIMESTAMPTZ,
  "updatedByProfileId" UUID        NOT NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_radar_pixel_configs_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_key"       UNIQUE ("teamId"),
  CONSTRAINT "corretor_studio_team_radar_pixel_configs_publicToken_key"  UNIQUE ("publicToken"),
  CONSTRAINT "corretor_studio_team_radar_pixel_configs_teamId_fkey"      FOREIGN KEY ("teamId")             REFERENCES "public"."corretor_studio_teams"("id")    ON DELETE CASCADE,
  CONSTRAINT "corretor_studio_team_radar_pixel_configs_updatedByPId_fkey" FOREIGN KEY ("updatedByProfileId") REFERENCES "public"."corretor_studio_profiles"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "corretor_studio_team_radar_pixel_configs_publicToken_idx"       ON "public"."corretor_studio_team_radar_pixel_configs" ("publicToken");
CREATE INDEX IF NOT EXISTS "corretor_studio_team_radar_pixel_configs_updatedByProfileId_idx" ON "public"."corretor_studio_team_radar_pixel_configs" ("updatedByProfileId");

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_team_radar_pixel_hit_logs" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "teamId"         UUID        NOT NULL,
  "eventType"      TEXT        NOT NULL,
  "visitorSession" TEXT        NOT NULL,
  "origin"         TEXT,
  "userAgent"      TEXT,
  "metadata"       JSONB,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_team_radar_pixel_hit_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "corretor_studio_team_radar_pixel_hit_logs_teamId_createdAt_idx"
  ON "public"."corretor_studio_team_radar_pixel_hit_logs" ("teamId", "createdAt" DESC);
