-- Stamp isBounced em audiência inválida/bounceada (exceto caixa cheia) e bloqueia
-- consent Radar de e-mail correspondente.
--
-- Recorte do backfill (MUST):
--   - Entra: bounce já ocorrido EXCETO caixa cheia (MailboxFull / "inbox was full").
--     Terra ContentRejected ENTRA (não é ISP morto; só entra via bounce).
--     Permanent / Transient genérico ENTRA.
--   - Entra: domínio typo / ISP morto / local-part com ponto inválido (mesmo sem bounce).
--   - Não entra: role (admin, contato, financeiro…) — só recusa de ingresso novo.
--   - Não desmarca caixa cheia já stampada pelo webhook antigo (WHERE isBounced = false).
--
-- Listas de domínio devem permanecer alinhadas a AUDIENCE_TYPO_DOMAINS e
-- AUDIENCE_DEAD_ISP_DOMAINS em lib/email/audience-prevalidation.ts.
-- terra.com.br e uol.com.br NÃO estão na lista de ISP morto.
--
-- Idempotente: UPDATE só onde isBounced = false; INSERT de consent com ON CONFLICT.

UPDATE "public"."corretor_studio_email_contacts" AS c
SET
  "isBounced" = true,
  "updatedAt" = now()
WHERE c."isBounced" = false
  AND (
    lower(c."email") IN (
      SELECT DISTINCT lower(l."recipientEmail")
      FROM "public"."corretor_studio_email_logs" AS l
      WHERE l."status" = 'bounced'::"email_log_status"
        AND NOT EXISTS (
          SELECT 1
          FROM "public"."corretor_studio_email_events" AS e
          WHERE e."logId" = l."id"
            AND e."type" = 'bounced'::"email_event_type"
            AND (
              coalesce(e."metadata"->>'bounceMessage', '') ILIKE '%inbox was full%'
              OR coalesce(e."metadata"->>'bounceSubType', '') = 'MailboxFull'
            )
        )
      UNION
      SELECT DISTINCT lower(l."recipientEmail")
      FROM "public"."corretor_studio_email_events" AS e
      JOIN "public"."corretor_studio_email_logs" AS l ON l."id" = e."logId"
      WHERE e."type" = 'bounced'::"email_event_type"
        AND coalesce(e."metadata"->>'bounceMessage', '') NOT ILIKE '%inbox was full%'
        AND coalesce(e."metadata"->>'bounceSubType', '') IS DISTINCT FROM 'MailboxFull'
    )
    OR (
      position('@' IN c."email") > 1
      AND (
        lower(split_part(c."email", '@', 2)) IN (
          'gmail.com.br',
          'gamil.com',
          'gamil.com.br',
          'gmal.com',
          'gmial.com',
          'gmaill.com',
          'gnail.com',
          'gmail.con',
          'gmail.cm',
          'gmail.co',
          'hotmai.com',
          'hotmal.com',
          'homail.com',
          'hormail.com',
          'outlok.com',
          'yahooo.com',
          'yahooo.com.br',
          'ig.com.br',
          'superig.com.br',
          'bol.com.br',
          'brturbo.com.br',
          'ibest.com.br',
          'zipmail.com.br',
          'click21.com.br'
        )
        OR lower(split_part(c."email", '@', 2)) LIKE '%.combr'
        OR split_part(c."email", '@', 1) LIKE '.%'
        OR split_part(c."email", '@', 1) LIKE '%.'
        OR split_part(c."email", '@', 1) LIKE '%..%'
      )
    )
  );

INSERT INTO "public"."corretor_studio_radar_channel_consents" (
  "id",
  "profileId",
  "teamId",
  "channel",
  "status",
  "reason",
  "sourceType",
  "sourceId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  i."profileId",
  i."teamId",
  'email'::"radar_channel",
  'blocked'::"radar_consent_status",
  'bounce'::"radar_consent_reason",
  'email_contact',
  NULL,
  now(),
  now()
FROM "public"."corretor_studio_radar_identities" AS i
WHERE i."type" = 'email'::"radar_identity_type"
  AND i."normalizedValue" IN (
    SELECT lower(c."email")
    FROM "public"."corretor_studio_email_contacts" AS c
    WHERE c."isBounced" = true
  )
ON CONFLICT ("profileId", "channel") DO UPDATE
SET
  "status" = EXCLUDED."status",
  "reason" = EXCLUDED."reason",
  "updatedAt" = now();
