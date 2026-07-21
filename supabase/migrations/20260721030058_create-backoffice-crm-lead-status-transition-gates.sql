-- CRM backoffice lead status transition gates + field rules (BackofficeLeadStatus)
-- Segregated from product LeadStatus gates.

CREATE TABLE IF NOT EXISTS "backoffice_crm_lead_status_transition_gates" (
    "id"                   UUID                                NOT NULL DEFAULT gen_random_uuid(),
    "slug"                 TEXT                                NOT NULL,
    "name"                 TEXT                                NOT NULL,
    "gateType"             "BackofficeLeadTransitionGateType"  NOT NULL,
    "sourceStatus"         "backoffice_lead_status",
    "targetStatus"         "backoffice_lead_status",
    "config"               JSONB                               NOT NULL DEFAULT '{}'::jsonb,
    "blockerType"          TEXT                                NOT NULL,
    "errorMessage"         TEXT,
    "isEnabled"            BOOLEAN                             NOT NULL DEFAULT true,
    "sortOrder"            INTEGER                             NOT NULL DEFAULT 0,
    "updatedByProfileId"   UUID                                NOT NULL,
    "createdAt"            TIMESTAMPTZ                         NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ                         NOT NULL DEFAULT now(),

    CONSTRAINT "backoffice_crm_lead_status_transition_gates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_crm_lead_status_transition_gates_slug_key"
    ON "backoffice_crm_lead_status_transition_gates" ("slug");

CREATE INDEX IF NOT EXISTS "backoffice_crm_lead_status_transition_gates_sort_order_idx"
    ON "backoffice_crm_lead_status_transition_gates" ("sortOrder");

CREATE INDEX IF NOT EXISTS "backoffice_crm_lead_status_transition_gates_enabled_idx"
    ON "backoffice_crm_lead_status_transition_gates" ("isEnabled");

ALTER TABLE "backoffice_crm_lead_status_transition_gates"
    DROP CONSTRAINT IF EXISTS "backoffice_crm_lead_status_transition_gates_updatedByProfileId_fkey";

ALTER TABLE "backoffice_crm_lead_status_transition_gates"
    ADD CONSTRAINT "backoffice_crm_lead_status_transition_gates_updatedByProfileId_fkey"
    FOREIGN KEY ("updatedByProfileId")
    REFERENCES "corretor_studio_profiles" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "backoffice_crm_lead_status_transition_gates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_crm_lead_status_transition_gates_service_role_all"
    ON "backoffice_crm_lead_status_transition_gates";

CREATE POLICY "backoffice_crm_lead_status_transition_gates_service_role_all"
    ON "backoffice_crm_lead_status_transition_gates"
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE TABLE IF NOT EXISTS "backoffice_crm_lead_status_transition_field_rules" (
    "id"                   UUID                              NOT NULL DEFAULT gen_random_uuid(),
    "targetStatus"         "backoffice_lead_status"          NOT NULL,
    "fieldKey"             "BackofficeLeadTransitionFieldKey" NOT NULL,
    "isEnabled"            BOOLEAN                           NOT NULL DEFAULT true,
    "updatedByProfileId"   UUID                              NOT NULL,
    "createdAt"            TIMESTAMPTZ                       NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ                       NOT NULL DEFAULT now(),

    CONSTRAINT "backoffice_crm_lead_status_transition_field_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_crm_lead_status_transition_field_rules_target_field_key"
    ON "backoffice_crm_lead_status_transition_field_rules" ("targetStatus", "fieldKey");

CREATE INDEX IF NOT EXISTS "backoffice_crm_lead_status_transition_field_rules_target_status_idx"
    ON "backoffice_crm_lead_status_transition_field_rules" ("targetStatus");

ALTER TABLE "backoffice_crm_lead_status_transition_field_rules"
    DROP CONSTRAINT IF EXISTS "backoffice_crm_lead_status_transition_field_rules_updatedByProfileId_fkey";

ALTER TABLE "backoffice_crm_lead_status_transition_field_rules"
    ADD CONSTRAINT "backoffice_crm_lead_status_transition_field_rules_updatedByProfileId_fkey"
    FOREIGN KEY ("updatedByProfileId")
    REFERENCES "corretor_studio_profiles" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "backoffice_crm_lead_status_transition_field_rules" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_crm_lead_status_transition_field_rules_service_role_all"
    ON "backoffice_crm_lead_status_transition_field_rules";

CREATE POLICY "backoffice_crm_lead_status_transition_field_rules_service_role_all"
    ON "backoffice_crm_lead_status_transition_field_rules"
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

INSERT INTO "backoffice_crm_lead_status_transition_gates"
    ("slug", "name", "gateType", "sourceStatus", "targetStatus", "config", "blockerType", "errorMessage", "isEnabled", "sortOrder", "updatedByProfileId")
SELECT
    seed.slug,
    seed.name,
    seed.gate_type::"BackofficeLeadTransitionGateType",
    seed.source_status::"backoffice_lead_status",
    seed.target_status::"backoffice_lead_status",
    seed.config::jsonb,
    seed.blocker_type,
    seed.error_message,
    true,
    seed.sort_order,
    profile.id
FROM (
    VALUES
        (
            'crm-allowed-targets-all',
            'CRM: destinos permitidos (todos)',
            'allowed_target_statuses',
            NULL,
            NULL,
            '{"allowedTargetStatuses":["new_opportunity","scheduled","no_show","new_adhesion","lost","implementation","finalized","proposal","future_contact","deal_closed","disqualified"]}',
            'validation_error',
            'Transição de status não permitida',
            10
        ),
        (
            'crm-require-closer-scheduled',
            'CRM: exigir closer para agendado',
            'require_closer',
            NULL,
            NULL,
            '{"targetStatuses":["scheduled"]}',
            'closer_required',
            'Closer é obrigatório para leads agendados',
            20
        ),
        (
            'crm-require-schedule-scheduled',
            'CRM: exigir data de agendamento',
            'require_schedule_artifacts',
            NULL,
            'scheduled',
            '{}',
            'schedule_required',
            'Data de agendamento é obrigatória',
            30
        )
) AS seed(slug, name, gate_type, source_status, target_status, config, blocker_type, error_message, sort_order)
CROSS JOIN LATERAL (
    SELECT "id"
    FROM "corretor_studio_profiles"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS profile
ON CONFLICT ("slug") DO NOTHING;
