-- Remove contato inválido mjc.f.@terra.com.br (Kathrein / Golden Cross)
-- Causa: Resend 422 Invalid `to` — ponto final no local-part envenenava lote de 100.
-- Idempotente.

DO $$
DECLARE
  v_email text := 'mjc.f.@terra.com.br';
  v_list_form3 uuid := 'c8e3f1a2-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
  v_list_master uuid := 'ababf899-4fa0-42de-9fa2-00d04a6a703c';
  v_campaign_id uuid := '62779d96-68c3-44b4-af8b-33566f6f52b3';
  v_log_id uuid;
BEGIN
  -- Contatos nas listas Form 3 e master Golden Cross
  DELETE FROM public.corretor_studio_email_contacts
  WHERE lower(trim(email)) = v_email
    AND "listId" IN (v_list_form3, v_list_master);

  -- Recalcula totais das listas afetadas
  UPDATE public.corretor_studio_email_contact_lists l
  SET
    "totalContacts" = (
      SELECT count(*)::int
      FROM public.corretor_studio_email_contacts c
      WHERE c."listId" = l.id
    ),
    "updatedAt" = now()
  WHERE l.id IN (v_list_form3, v_list_master);

  -- Logs failed desse e-mail na campanha Form 3 → suppressed (fora do retryFailedOnly)
  FOR v_log_id IN
    SELECT id
    FROM public.corretor_studio_email_logs
    WHERE "campaignId" = v_campaign_id
      AND lower(trim("recipientEmail")) = v_email
      AND status = 'failed'
  LOOP
    UPDATE public.corretor_studio_email_logs
    SET status = 'suppressed', "updatedAt" = now()
    WHERE id = v_log_id;

    INSERT INTO public.corretor_studio_email_events (
      id, "logId", type, "occurredAt", metadata, "createdAt"
    )
    VALUES (
      gen_random_uuid(),
      v_log_id,
      'suppressed',
      now(),
      jsonb_build_object(
        'reason', 'E-mail inválido removido da lista',
        'email', v_email,
        'source', 'migration:remove-invalid-email-mjc-f-terra-kathrein'
      ),
      now()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
