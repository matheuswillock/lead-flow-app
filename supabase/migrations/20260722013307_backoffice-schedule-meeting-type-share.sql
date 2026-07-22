-- Backoffice schedule parity: meetingType + public share token fields

ALTER TABLE "public"."backoffice_leads"
  ADD COLUMN IF NOT EXISTS "meetingType" text;

ALTER TABLE "public"."backoffice_leads_schedule"
  ADD COLUMN IF NOT EXISTS "meetingType" text;

ALTER TABLE "public"."backoffice_leads_schedule"
  ADD COLUMN IF NOT EXISTS "publicShareTokenHash" text;

ALTER TABLE "public"."backoffice_leads_schedule"
  ADD COLUMN IF NOT EXISTS "publicShareExpiresAt" timestamp(6) with time zone;

CREATE INDEX IF NOT EXISTS "backoffice_leads_schedule_public_share_token_hash_idx"
  ON public.backoffice_leads_schedule USING btree ("publicShareTokenHash");
