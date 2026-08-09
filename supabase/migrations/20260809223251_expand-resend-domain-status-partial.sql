-- Expand resendDomainStatus check to match Resend DomainStatus values
-- (partially_verified / partially_failed when tracking DNS is pending).

ALTER TABLE "public"."email_team_settings"
  DROP CONSTRAINT IF EXISTS "email_team_settings_resendDomainStatus_check",
  ADD CONSTRAINT "email_team_settings_resendDomainStatus_check"
    CHECK (
      "resendDomainStatus" IN (
        'not_started',
        'pending',
        'verified',
        'failed',
        'temporary_failure',
        'partially_verified',
        'partially_failed'
      )
      OR "resendDomainStatus" IS NULL
    );
