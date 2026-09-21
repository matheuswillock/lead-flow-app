-- Permite transição de Nova oportunidade para Desqualificado
--
-- Aditiva e idempotente: soma "disqualified" ao array allowedTargetStatuses do
-- gate `new_opportunity_allowed_targets` sem sobrescrever customizações feitas
-- via PUT /api/v1/backoffice/lead-status-transition-gates (um manager pode ter
-- adicionado outros alvos permitidos e/ou uma errorMessage própria). Um UPDATE
-- com literais fixos de config/errorMessage apagaria essas customizações.

-- Se o gate ainda não existir (nunca deveria em ambiente com
-- 20260626182551_lead-status-transition-gates.sql já aplicada, mas mantém a
-- migration segura em qualquer ordem de replay), cria com o seed completo.
--
-- "createdAt"/"updatedAt" precisam vir explícitos no INSERT: em produção a
-- coluna "updatedAt" está NOT NULL sem default físico (prisma/schema.prisma
-- usa `@updatedAt` sozinho, sem `@default(now())` — o valor é resolvido no
-- Prisma Client, não no banco; ver docs/audits/prisma-migrations-drift-2026-08-23.md
-- §3). Sem a coluna na lista, o INSERT viola a constraint NOT NULL
-- (SQLSTATE 23502) antes mesmo de avaliar o ON CONFLICT.
INSERT INTO "backoffice_lead_status_transition_gates"
    ("slug", "name", "gateType", "sourceStatus", "targetStatus", "config", "blockerType", "errorMessage", "isEnabled", "sortOrder", "updatedByProfileId", "createdAt", "updatedAt")
SELECT
    'new_opportunity_allowed_targets',
    'Nova oportunidade: destinos permitidos',
    'allowed_target_statuses'::"BackofficeLeadTransitionGateType",
    'new_opportunity'::"LeadStatus",
    NULL,
    '{"allowedTargetStatuses":["scheduled","future_sale","opportunityLost","disqualified"]}'::jsonb,
    'validation_error',
    'De Nova oportunidade, o lead só pode ser movido para Agendado, Venda Futura, Perdido ou Desqualificado.',
    true,
    10,
    profile.id,
    now(),
    now()
FROM (
    SELECT "id"
    FROM "corretor_studio_profiles"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS profile
ON CONFLICT ("slug") DO NOTHING;

-- Se já existir (o caso real em qualquer ambiente com a migration inicial
-- aplicada), acrescenta "disqualified" ao array allowedTargetStatuses só
-- quando ainda não estiver presente. errorMessage e as demais chaves de
-- config permanecem intocadas, preservando customização já gravada pelo PUT.
UPDATE "backoffice_lead_status_transition_gates"
SET
    "config" = jsonb_set(
        "config",
        '{allowedTargetStatuses}',
        COALESCE("config" -> 'allowedTargetStatuses', '[]'::jsonb) || '["disqualified"]'::jsonb
    ),
    "updatedAt" = now()
WHERE "slug" = 'new_opportunity_allowed_targets'
  AND NOT (COALESCE("config" -> 'allowedTargetStatuses', '[]'::jsonb) ? 'disqualified');
