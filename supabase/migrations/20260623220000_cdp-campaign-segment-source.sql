-- CDP segment as optional email campaign recipient source
ALTER TABLE "public"."corretor_studio_email_campaigns"
  ADD COLUMN IF NOT EXISTS "cdpSegmentSlug" TEXT;

ALTER TABLE "public"."corretor_studio_email_campaigns"
  ALTER COLUMN "contactListId" DROP NOT NULL;
