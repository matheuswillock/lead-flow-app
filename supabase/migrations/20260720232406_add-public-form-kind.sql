ALTER TABLE "public"."corretor_studio_public_forms"
  ADD COLUMN IF NOT EXISTS "formKind" VARCHAR(40) NOT NULL DEFAULT 'standard';
