-- Add isBlocklist flag for team email contact blocklists (append-only).
ALTER TABLE "public"."corretor_studio_email_contact_lists"
  ADD COLUMN IF NOT EXISTS "isBlocklist" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "corretor_studio_email_contact_lists_teamId_isBlocklist_idx"
  ON "public"."corretor_studio_email_contact_lists" ("teamId", "isBlocklist");
