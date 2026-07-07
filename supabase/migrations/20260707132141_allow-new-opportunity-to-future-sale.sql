-- Permite transição de Nova oportunidade para Venda Futura

UPDATE "backoffice_lead_status_transition_gates"
SET
    "config" = '{"allowedTargetStatuses":["scheduled","future_sale","opportunityLost"]}'::jsonb,
    "errorMessage" = 'De Nova oportunidade, o lead só pode ser movido para Agendado, Venda Futura ou Perdido.',
    "updatedAt" = now()
WHERE "slug" = 'new_opportunity_allowed_targets';
