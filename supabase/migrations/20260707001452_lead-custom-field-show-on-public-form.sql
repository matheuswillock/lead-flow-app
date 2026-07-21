-- Add showOnPublicForm flag to lead custom field definitions
ALTER TABLE "public"."corretor_studio_lead_custom_field_definitions"
  ADD COLUMN IF NOT EXISTS "showOnPublicForm" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "lead_custom_field_defs_team_public_order_idx"
  ON "public"."corretor_studio_lead_custom_field_definitions" ("teamId", "isActive", "showOnPublicForm", "displayOrder");
