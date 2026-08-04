ALTER TABLE "public"."corretor_studio_email_campaigns"
  ADD COLUMN IF NOT EXISTS "source_contact_list_ids" uuid[] DEFAULT '{}';
