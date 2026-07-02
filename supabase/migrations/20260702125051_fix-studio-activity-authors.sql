-- Retroactively assign Corretor Studio as feed author for system-generated activities.

DO $$
DECLARE
  studio_identity jsonb := jsonb_build_object(
    'displayAuthor', 'Corretor Studio',
    'authorAvatarUrl', '/corretor-studio-icon.svg',
    'authorSource', 'studio'
  );
BEGIN
  -- Grupo A: integrações de criação de lead
  UPDATE public.corretor_studio_lead_activities la
  SET
    "createdBy" = NULL,
    payload = COALESCE(la.payload, '{}'::jsonb) || studio_identity
  WHERE la.payload->>'kind' = 'lead_creation'
    AND (
      la.payload->>'channel' IN ('public_lead_form', 'whatsapp', 'webhook')
      OR la.payload->>'provider' IN ('meta', 'studio', 'evolution')
    )
    AND (
      la."createdBy" IS NOT NULL
      OR COALESCE(la.payload->>'authorSource', '') <> 'studio'
      OR COALESCE(la.payload->>'displayAuthor', '') <> 'Corretor Studio'
    );

  -- Grupo B: ações automáticas de agenda
  UPDATE public.corretor_studio_lead_activities la
  SET
    "createdBy" = NULL,
    payload = COALESCE(la.payload, '{}'::jsonb) || studio_identity
  WHERE la.payload->>'kind' = 'schedule'
    AND la.payload->>'action' IN (
      'invite_dispatch',
      'invite_resend_dispatch',
      'closer_notification_failed',
      'transfer_schedule_failed'
    )
    AND (
      la."createdBy" IS NOT NULL
      OR COALESCE(la.payload->>'authorSource', '') <> 'studio'
      OR COALESCE(la.payload->>'displayAuthor', '') <> 'Corretor Studio'
    );

  -- Grupo C: studio bot e associados
  UPDATE public.corretor_studio_lead_activities la
  SET
    "createdBy" = NULL,
    payload = COALESCE(la.payload, '{}'::jsonb) || studio_identity
  WHERE (
      la.type = 'studio_bot'
      OR la.payload->>'kind' IN (
        'proposal_criticism',
        'sale_registered',
        'required_document_rejected',
        'docs_complete',
        'payment_proof_uploaded'
      )
    )
    AND (
      la."createdBy" IS NOT NULL
      OR COALESCE(la.payload->>'authorSource', '') <> 'studio'
      OR COALESCE(la.payload->>'displayAuthor', '') <> 'Corretor Studio'
    );

  -- Grupo D: transferência de gestor
  UPDATE public.corretor_studio_lead_activities la
  SET payload = COALESCE(la.payload, '{}'::jsonb) || studio_identity
  WHERE la."createdBy" IS NULL
    AND la.type = 'status_change'
    AND la.body LIKE 'Lead transferido%'
    AND (
      COALESCE(la.payload->>'authorSource', '') <> 'studio'
      OR COALESCE(la.payload->>'displayAuthor', '') <> 'Corretor Studio'
    );

  -- Grupo E: agendamentos do formulário público
  UPDATE public.corretor_studio_lead_activities la
  SET
    "createdBy" = NULL,
    payload = COALESCE(la.payload, '{}'::jsonb) || studio_identity
  WHERE la.payload->>'kind' = 'schedule'
    AND la.payload->>'action' IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.corretor_studio_lead_activities la2
      WHERE la2."leadId" = la."leadId"
        AND la2.payload->>'kind' = 'lead_creation'
        AND la2.payload->>'channel' = 'public_lead_form'
    )
    AND (
      la."createdBy" IS NOT NULL
      OR COALESCE(la.payload->>'authorSource', '') <> 'studio'
      OR COALESCE(la.payload->>'displayAuthor', '') <> 'Corretor Studio'
    );
END $$;
