-- EmailCampaignDispatch.retryFailedOnly + índice de agregação de logs por dispatch
-- Physical tables: corretor_studio_email_campaign_dispatches / corretor_studio_email_logs

ALTER TABLE "public"."corretor_studio_email_campaign_dispatches"
  ADD COLUMN IF NOT EXISTS "retryFailedOnly" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "corretor_studio_email_logs_team_dispatch_status_idx"
  ON "public"."corretor_studio_email_logs" ("teamId", "dispatchId", "status");
