-- "createdAt"/"updatedAt" vêm explícitos de propósito: prisma/schema.prisma
-- declara `updatedAt` como `@updatedAt` sozinho, sem `@default(now())` — o valor
-- é resolvido no Prisma Client, não no banco. Um `prisma db push` derruba o
-- default físico da tabela (docs/audits/prisma-migrations-drift-2026-08-23.md
-- §3) e, a partir daí, o replay viola NOT NULL com SQLSTATE 23502 — foi
-- exatamente o que aconteceu nesta tabela no Apply corrigido pelo PR #1208.
INSERT INTO "backoffice_lead_status_transition_gates"
    ("slug", "name", "gateType", "sourceStatus", "targetStatus", "config", "blockerType", "errorMessage", "isEnabled", "sortOrder", "updatedByProfileId", "createdAt", "updatedAt")
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
    profile.id,
    now(),
    now()
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
