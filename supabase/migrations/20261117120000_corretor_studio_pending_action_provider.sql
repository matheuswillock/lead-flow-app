-- AlterTable
ALTER TABLE "corretor_studio_pending_actions" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "corretor_studio_pending_actions" ADD COLUMN IF NOT EXISTS "provider_environment" TEXT;
ALTER TABLE "corretor_studio_pending_actions" ADD COLUMN IF NOT EXISTS "provider_session_id" UUID;
ALTER TABLE "corretor_studio_pending_actions" ADD COLUMN IF NOT EXISTS "provider_attempt_id" UUID;
ALTER TABLE "corretor_studio_pending_actions" ADD COLUMN IF NOT EXISTS "provider_external_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "corretor_studio_pending_actions_provider_external_id_idx"
  ON "corretor_studio_pending_actions"("provider_external_id");
