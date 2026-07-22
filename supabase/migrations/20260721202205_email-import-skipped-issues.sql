-- Add skippedIssues JSON sample on email import jobs (invalid row feedback).
ALTER TABLE "public"."corretor_studio_email_import_jobs"
  ADD COLUMN IF NOT EXISTS "skippedIssues" JSONB;
