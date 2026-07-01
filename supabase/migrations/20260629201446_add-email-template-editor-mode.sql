-- Add editorMode column to track whether a template was authored in HTML or blocks mode.
-- Default is 'blocks' to match existing behavior for templates with mailyJson content.
ALTER TABLE "public"."corretor_studio_email_templates"
  ADD COLUMN IF NOT EXISTS "editorMode" TEXT NOT NULL DEFAULT 'blocks';
