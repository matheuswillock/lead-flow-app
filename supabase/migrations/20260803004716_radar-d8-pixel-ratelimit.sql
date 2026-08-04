-- D8: Rate limit table for pixel hit endpoint (clone of public_form_rate_limits)

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_radar_pixel_rate_limits" (
  "key"       TEXT        NOT NULL,
  "count"     INTEGER     NOT NULL DEFAULT 1,
  "resetAt"   TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "corretor_studio_radar_pixel_rate_limits_pkey" PRIMARY KEY ("key")
);
