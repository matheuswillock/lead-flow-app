-- Allow draft leads without a funnel status (status = NULL)
ALTER TABLE "public"."corretor_studio_leads"
  ALTER COLUMN "status" DROP NOT NULL,
  ALTER COLUMN "status" DROP DEFAULT;
