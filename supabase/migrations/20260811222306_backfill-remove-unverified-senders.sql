-- Remove remetentes de times sem domínio Resend configurado e validado que
-- bata com o domínio do remetente. Time volta a usar o From da plataforma
-- (deliveryby@corretorstudio.com) via fallback de resolveCampaignFrom.
-- Idempotente: reexecução não encontra mais linhas para remover.
-- Tabelas físicas: email_team_senders / email_team_settings (@@map).

DELETE FROM "public"."email_team_senders" AS sender
WHERE sender.email NOT ILIKE '%@corretorstudio.com'
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."email_team_settings" settings
    WHERE settings."teamId" = sender."teamId"
      AND settings."resendDomainName" IS NOT NULL
      AND settings."resendDomainStatus" IN ('verified', 'partially_verified', 'partially_failed')
      AND (
        lower(split_part(sender.email, '@', 2)) = lower(settings."resendDomainName")
        OR lower(split_part(sender.email, '@', 2)) LIKE '%.' || lower(settings."resendDomainName")
      )
  );
