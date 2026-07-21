-- Migration: lead-status-transition-gates
-- Global backoffice transition gates (replaces hardcoded LeadUseCase rules)

DO $$ BEGIN
  CREATE TYPE "BackofficeLeadTransitionGateType" AS ENUM (
    'allowed_target_statuses',
    'block_targets_when_field_equals',
    'require_meeting_heald_on_exit',
    'require_no_show_preconditions',
    'require_sales_info',
    'require_finalize_contract',
    'require_schedule_artifacts',
    'require_trigger_future_sale',
    'require_trigger_loss_reason',
    'require_email_for_online_schedule',
    'require_finalize_contract_flow'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "backoffice_lead_status_transition_gates" (
    "id"                   UUID                                NOT NULL DEFAULT gen_random_uuid(),
    "slug"                 TEXT                                NOT NULL,
    "name"                 TEXT                                NOT NULL,
    "gateType"             "BackofficeLeadTransitionGateType"  NOT NULL,
    "sourceStatus"         "LeadStatus",
    "targetStatus"         "LeadStatus",
    "config"               JSONB                               NOT NULL DEFAULT '{}'::jsonb,
    "blockerType"          TEXT                                NOT NULL,
    "errorMessage"         TEXT,
    "isEnabled"            BOOLEAN                             NOT NULL DEFAULT true,
    "sortOrder"            INTEGER                             NOT NULL DEFAULT 0,
    "updatedByProfileId"   UUID                                NOT NULL,
    "createdAt"            TIMESTAMPTZ                         NOT NULL DEFAULT now(),
    "updatedAt"            TIMESTAMPTZ                         NOT NULL DEFAULT now(),

    CONSTRAINT "backoffice_lead_status_transition_gates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_lead_status_transition_gates_slug_key"
    ON "backoffice_lead_status_transition_gates" ("slug");

CREATE INDEX IF NOT EXISTS "backoffice_lead_status_transition_gates_sort_order_idx"
    ON "backoffice_lead_status_transition_gates" ("sortOrder");

CREATE INDEX IF NOT EXISTS "backoffice_lead_status_transition_gates_enabled_idx"
    ON "backoffice_lead_status_transition_gates" ("isEnabled");

ALTER TABLE "backoffice_lead_status_transition_gates"
    DROP CONSTRAINT IF EXISTS "backoffice_lead_status_transition_gates_updatedByProfileId_fkey";

ALTER TABLE "backoffice_lead_status_transition_gates"
    ADD CONSTRAINT "backoffice_lead_status_transition_gates_updatedByProfileId_fkey"
    FOREIGN KEY ("updatedByProfileId")
    REFERENCES "corretor_studio_profiles" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "backoffice_lead_status_transition_gates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backoffice_lead_status_transition_gates_service_role_all"
    ON "backoffice_lead_status_transition_gates";

CREATE POLICY "backoffice_lead_status_transition_gates_service_role_all"
    ON "backoffice_lead_status_transition_gates"
    AS PERMISSIVE
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Seed migrated hardcoded gates
INSERT INTO "backoffice_lead_status_transition_gates"
    ("slug", "name", "gateType", "sourceStatus", "targetStatus", "config", "blockerType", "errorMessage", "isEnabled", "sortOrder", "updatedByProfileId")
SELECT
    seed.slug,
    seed.name,
    seed.gate_type::"BackofficeLeadTransitionGateType",
    seed.source_status::"LeadStatus",
    seed.target_status::"LeadStatus",
    seed.config::jsonb,
    seed.blocker_type,
    seed.error_message,
    true,
    seed.sort_order,
    profile.id
FROM (
    VALUES
        (
            'new_opportunity_allowed_targets',
            'Nova oportunidade: destinos permitidos',
            'allowed_target_statuses',
            'new_opportunity',
            NULL,
            '{"allowedTargetStatuses":["scheduled","opportunityLost"]}',
            'validation_error',
            'De Nova oportunidade, o lead só pode ser movido para Agendado ou Perdido.',
            10
        ),
        (
            'scheduled_block_revert_when_meeting_held',
            'Agendado: bloquear retorno com reunião realizada',
            'block_targets_when_field_equals',
            'scheduled',
            NULL,
            '{"field":"meetingHeald","equals":"yes","blockedTargetStatuses":["new_opportunity","no_show"]}',
            'validation_error',
            'Lead com reunião realizada não pode voltar para Nova oportunidade ou No-show.',
            20
        ),
        (
            'offer_negotiation_require_sales_info',
            'Negociação: exigir dados de venda',
            'require_sales_info',
            'offerNegotiation',
            NULL,
            '{"targetStatuses":["pending_documents","offerSubmission","dps_agreement","invoicePayment","contract_finalized"]}',
            'sales_info',
            'Preencha ticket, data de vigência e plano vendido para continuar a mudança de status.',
            30
        ),
        (
            'offer_submission_require_finalize_contract',
            'Proposta: exigir contrato finalizado',
            'require_finalize_contract',
            'offerSubmission',
            NULL,
            '{"targetStatuses":["invoicePayment","contract_finalized"]}',
            'finalize_contract',
            'Para mover de Proposta para este status, você precisa finalizar o contrato!',
            40
        ),
        (
            'no_show_preconditions',
            'No-show: pré-condições de agendamento',
            'require_no_show_preconditions',
            NULL,
            'no_show',
            '{}',
            'validation_error',
            NULL,
            50
        ),
        (
            'scheduled_require_meeting_heald_on_exit',
            'Agendado: confirmar reunião ao sair',
            'require_meeting_heald_on_exit',
            'scheduled',
            NULL,
            '{"exemptTargetStatuses":["scheduled","no_show","new_opportunity"]}',
            'meeting_heald',
            'Reunião não marcada como realizada. Somente o master ou o closer do lead pode confirmar.',
            60
        ),
        (
            'scheduled_require_schedule_artifacts',
            'Agendado: exigir agendamento válido',
            'require_schedule_artifacts',
            NULL,
            'scheduled',
            '{}',
            'schedule_required',
            'Lead precisa de um agendamento válido antes de mudar para Agendado. Use o fluxo de agendamento.',
            70
        ),
        (
            'scheduled_online_require_email',
            'Agendado online: exigir e-mail',
            'require_email_for_online_schedule',
            NULL,
            'scheduled',
            '{}',
            'email_required',
            'Lead precisa de um email para agendamento online. Preencha o email do lead antes de agendar.',
            75
        ),
        (
            'future_sale_require_trigger',
            'Venda futura: exigir data de retorno',
            'require_trigger_future_sale',
            NULL,
            'future_sale',
            '{}',
            'future_sale_trigger',
            'Venda Futura exige data válida para entrar em contato.',
            80
        ),
        (
            'opportunity_lost_require_trigger',
            'Perdido: exigir motivo',
            'require_trigger_loss_reason',
            NULL,
            'opportunityLost',
            '{}',
            'loss_reason_trigger',
            'Informe o motivo para concluir a mudança de status.',
            90
        ),
        (
            'operator_denied_require_trigger',
            'Negado operadora: exigir motivo',
            'require_trigger_loss_reason',
            NULL,
            'operator_denied',
            '{}',
            'loss_reason_trigger',
            'Informe o motivo para concluir a mudança de status.',
            100
        ),
        (
            'contract_finalized_require_flow',
            'Negócio fechado: usar fluxo de finalização',
            'require_finalize_contract_flow',
            NULL,
            'contract_finalized',
            '{"validateModeOnly":true}',
            'finalize_contract',
            'Para concluir como Negócio fechado, use o fluxo de fechamento de contrato.',
            5
        )
) AS seed(slug, name, gate_type, source_status, target_status, config, blocker_type, error_message, sort_order)
CROSS JOIN LATERAL (
    SELECT "id"
    FROM "corretor_studio_profiles"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS profile
ON CONFLICT ("slug") DO NOTHING;
