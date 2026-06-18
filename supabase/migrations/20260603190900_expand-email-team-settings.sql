ALTER TABLE "public"."email_team_settings"
  ADD COLUMN IF NOT EXISTS "dispatchBlockedDates"     jsonb,
  ADD COLUMN IF NOT EXISTS "dispatchTimeFrom"         text,
  ADD COLUMN IF NOT EXISTS "dispatchTimeTo"           text,
  ADD COLUMN IF NOT EXISTS "dispatchAllowedRoles"     text[] NOT NULL DEFAULT '{"manager","backoffice"}',
  ADD COLUMN IF NOT EXISTS "templateCreateRoles"      text[] NOT NULL DEFAULT '{"manager","backoffice"}',
  ADD COLUMN IF NOT EXISTS "templateApprovalRequired" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resendDomainId"           text,
  ADD COLUMN IF NOT EXISTS "resendDomainName"         text,
  ADD COLUMN IF NOT EXISTS "resendDomainStatus"       text;

ALTER TABLE "public"."email_team_settings"
  DROP CONSTRAINT IF EXISTS "email_team_settings_resendDomainStatus_check",
  ADD CONSTRAINT "email_team_settings_resendDomainStatus_check"
    CHECK (
      "resendDomainStatus" IN ('not_started','pending','verified','failed','temporary_failure')
      OR "resendDomainStatus" IS NULL
    );
