-- Migration: lead-status-transition-field-rules
-- Global backoffice rules for required lead fields on status transition

DO $$ BEGIN
  CREATE TYPE "BackofficeLeadTransitionFieldKey" AS ENUM (
    'age',
    'currentHealthPlan',
    'referenceHospital',
    'currentTreatment',
    'email',
    'phone',
    'cnpj'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "backoffice_lead_status_transition_field_rules" (
    "id"                   UUID                              NOT NULL DEFAULT gen_random_uuid(),
    "targetStatus"         "LeadStatus"                      NOT NULL,
    "fieldKey"             "BackofficeLeadTransitionFieldKey"  NOT NULL,
    "isEnabled"            BOOLEAN                           NOT NULL DEFAULT true,
    "updatedByProfileId"   UUID                              NOT NULL,
    "createdAt"            TIMESTAMPTZ                       NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ                       NOT NULL DEFAULT now(),

    CONSTRAINT "backoffice_lead_status_transition_field_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_lead_status_transition_field_rules_target_field_key"
    ON "backoffice_lead_status_transition_field_rules" ("targetStatus", "fieldKey");

CREATE INDEX IF NOT EXISTS "backoffice_lead_status_transition_field_rules_target_status_idx"
    ON "backoffice_lead_status_transition_field_rules" ("targetStatus");

ALTER TABLE "backoffice_lead_status_transition_field_rules"
    DROP CONSTRAINT IF EXISTS "backoffice_lead_status_transition_field_rules_updatedByProfileId_fkey";

ALTER TABLE "backoffice_lead_status_transition_field_rules"
    ADD CONSTRAINT "backoffice_lead_status_transition_field_rules_updatedByProfileId_fkey"
    FOREIGN KEY ("updatedByProfileId")
    REFERENCES "corretor_studio_profiles" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "backoffice_lead_status_transition_field_rules" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_lead_status_transition_field_rules_service_role_all"
    ON "backoffice_lead_status_transition_field_rules";

CREATE POLICY "backoffice_lead_status_transition_field_rules_service_role_all"
    ON "backoffice_lead_status_transition_field_rules"
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Default Cotação rules: idade, plano e hospital (sem tratamento em andamento)
INSERT INTO "backoffice_lead_status_transition_field_rules"
    ("targetStatus", "fieldKey", "isEnabled", "updatedByProfileId")
SELECT
    'pricingRequest'::"LeadStatus",
    seed.field_key::"BackofficeLeadTransitionFieldKey",
    true,
    profile.id
FROM (
    VALUES
        ('age'),
        ('currentHealthPlan'),
        ('referenceHospital')
) AS seed(field_key)
CROSS JOIN LATERAL (
    SELECT "id"
    FROM "corretor_studio_profiles"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS profile
ON CONFLICT ("targetStatus", "fieldKey") DO NOTHING;
