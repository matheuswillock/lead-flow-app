-- Shared rate-limit store for public form endpoints (Vercel multi-instance safe).
CREATE TABLE IF NOT EXISTS "public"."corretor_studio_public_form_rate_limits" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "corretor_studio_public_form_rate_limits_resetAt_idx"
  ON "public"."corretor_studio_public_form_rate_limits" ("resetAt");
