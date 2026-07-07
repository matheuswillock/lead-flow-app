-- Lead custom field definitions and values (Item 2 / C1)

DO $$ BEGIN
  CREATE TYPE "public"."LeadCustomFieldType" AS ENUM (
    'text',
    'number',
    'date',
    'select',
    'multi_select',
    'boolean'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_lead_custom_field_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "createdBy" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "public"."LeadCustomFieldType" NOT NULL,
  "options" JSONB,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_lead_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."corretor_studio_lead_custom_field_values" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "definitionId" UUID NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "corretor_studio_lead_custom_field_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_lead_custom_field_definitions_teamId_key_key"
  ON "public"."corretor_studio_lead_custom_field_definitions" ("teamId", "key");

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_custom_field_definitions_teamId_isActive_displayOrder_idx"
  ON "public"."corretor_studio_lead_custom_field_definitions" ("teamId", "isActive", "displayOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "corretor_studio_lead_custom_field_values_leadId_definitionId_key"
  ON "public"."corretor_studio_lead_custom_field_values" ("leadId", "definitionId");

CREATE INDEX IF NOT EXISTS "corretor_studio_lead_custom_field_values_definitionId_idx"
  ON "public"."corretor_studio_lead_custom_field_values" ("definitionId");

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_lead_custom_field_definitions"
    ADD CONSTRAINT "corretor_studio_lead_custom_field_definitions_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_lead_custom_field_definitions"
    ADD CONSTRAINT "corretor_studio_lead_custom_field_definitions_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "public"."corretor_studio_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_lead_custom_field_values"
    ADD CONSTRAINT "corretor_studio_lead_custom_field_values_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "public"."corretor_studio_leads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."corretor_studio_lead_custom_field_values"
    ADD CONSTRAINT "corretor_studio_lead_custom_field_values_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "public"."corretor_studio_lead_custom_field_definitions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
