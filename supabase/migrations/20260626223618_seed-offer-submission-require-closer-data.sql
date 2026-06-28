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
            'offer_submission_require_closer',
            'Proposta: exigir closer do time',
            'require_closer',
            NULL,
            'offerSubmission',
            '{"targetStatuses":["offerSubmission"]}',
            'closer_required',
            'Selecione o closer do time para mover para Proposta.',
            35
        )
) AS seed(slug, name, gate_type, source_status, target_status, config, blocker_type, error_message, sort_order)
CROSS JOIN LATERAL (
    SELECT "id"
    FROM "corretor_studio_profiles"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS profile
ON CONFLICT ("slug") DO NOTHING;
