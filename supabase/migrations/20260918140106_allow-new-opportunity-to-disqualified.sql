-- Permite transição de Nova oportunidade para Desqualificado

UPDATE "backoffice_lead_status_transition_gates"
SET
    "config" = '{"allowedTargetStatuses":["scheduled","future_sale","opportunityLost","disqualified"]}'::jsonb,
    "errorMessage" = 'De Nova oportunidade, o lead só pode ser movido para Agendado, Venda Futura, Perdido ou Desqualificado.',
    "updatedAt" = now()
WHERE "slug" = 'new_opportunity_allowed_targets';
