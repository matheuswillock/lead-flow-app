-- Inbox V3 / T2.2: backfill idempotente de contatos canônicos + identities.
-- Sem merge heurístico LID↔phone. Grupos não viram contato pessoal.
-- Não sobrescreve nameSource MANUAL/LEAD nem phoneE164 já preenchido.
-- Conflitos de E.164 no mesmo time: perdedor fica CONFLICT sem phoneE164 duplicado.

-- 1) Derivar phoneE164 só para JID de telefone ainda sem E.164 e sem colisão.
WITH classified AS (
  SELECT
    c.id,
    c."teamId",
    c."remoteJid",
    CASE
      WHEN lower(c."remoteJid") LIKE '%@g.us' THEN 'GROUP'
      WHEN lower(c."remoteJid") LIKE '%@lid' THEN 'LID'
      WHEN (
        lower(c."remoteJid") LIKE '%@s.whatsapp.net'
        OR lower(c."remoteJid") LIKE '%@c.us'
      )
      AND split_part(c."remoteJid", '@', 1) ~ '^\d{8,15}$'
        THEN 'PHONE'
      ELSE 'UNKNOWN'
    END AS identity_type,
    CASE
      WHEN (
        lower(c."remoteJid") LIKE '%@s.whatsapp.net'
        OR lower(c."remoteJid") LIKE '%@c.us'
      )
      AND split_part(c."remoteJid", '@', 1) ~ '^\d{8,15}$'
        THEN '+' || split_part(c."remoteJid", '@', 1)
      ELSE NULL
    END AS derived_phone
  FROM public.team_whatsapp_contacts c
),
winners AS (
  SELECT DISTINCT ON (cl."teamId", cl.derived_phone)
    cl.id,
    cl."teamId",
    cl.derived_phone
  FROM classified cl
  WHERE cl.identity_type = 'PHONE'
    AND cl.derived_phone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.team_whatsapp_contacts existing
      WHERE existing."teamId" = cl."teamId"
        AND existing."phoneE164" = cl.derived_phone
        AND existing.id <> cl.id
    )
  ORDER BY cl."teamId", cl.derived_phone, cl.id
)
UPDATE public.team_whatsapp_contacts AS c
SET
  "phoneE164" = w.derived_phone,
  "syncState" = 'FRESH',
  "lastSeenAt" = coalesce(c."lastSeenAt", now()),
  "updatedAt" = now()
FROM winners w
WHERE c.id = w.id
  AND c."phoneE164" IS NULL;

-- 2) Contatos com o mesmo E.164 derivado já ocupado por outro registro → CONFLICT.
WITH classified AS (
  SELECT
    c.id,
    c."teamId",
    CASE
      WHEN (
        lower(c."remoteJid") LIKE '%@s.whatsapp.net'
        OR lower(c."remoteJid") LIKE '%@c.us'
      )
      AND split_part(c."remoteJid", '@', 1) ~ '^\d{8,15}$'
        THEN '+' || split_part(c."remoteJid", '@', 1)
      ELSE NULL
    END AS derived_phone
  FROM public.team_whatsapp_contacts c
  WHERE c."phoneE164" IS NULL
)
UPDATE public.team_whatsapp_contacts AS c
SET
  "syncState" = 'CONFLICT',
  "lastSeenAt" = coalesce(c."lastSeenAt", now()),
  "updatedAt" = now()
FROM classified cl
WHERE c.id = cl.id
  AND cl.derived_phone IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.team_whatsapp_contacts existing
    WHERE existing."teamId" = cl."teamId"
      AND existing."phoneE164" = cl.derived_phone
      AND existing.id <> cl.id
  );

-- 3) LID / UNKNOWN → UNRESOLVED (nunca deriva telefone de @lid).
UPDATE public.team_whatsapp_contacts AS c
SET
  "syncState" = 'UNRESOLVED',
  "lastSeenAt" = coalesce(c."lastSeenAt", now()),
  "updatedAt" = now()
WHERE (
    lower(c."remoteJid") LIKE '%@lid'
    OR (
      lower(c."remoteJid") NOT LIKE '%@g.us'
      AND lower(c."remoteJid") NOT LIKE '%@lid'
      AND lower(c."remoteJid") NOT LIKE '%@s.whatsapp.net'
      AND lower(c."remoteJid") NOT LIKE '%@c.us'
    )
    OR (
      (lower(c."remoteJid") LIKE '%@s.whatsapp.net' OR lower(c."remoteJid") LIKE '%@c.us')
      AND split_part(c."remoteJid", '@', 1) !~ '^\d{8,15}$'
    )
  )
  AND c."syncState" IS DISTINCT FROM 'CONFLICT';

-- 4) Preencher name apenas quando vazio (não rebaixa MANUAL/LEAD).
UPDATE public.team_whatsapp_contacts
SET
  name = nullif(trim(coalesce("displayName", "pushName")), ''),
  "updatedAt" = now()
WHERE name IS NULL
  AND nullif(trim(coalesce("displayName", "pushName")), '') IS NOT NULL;

-- 5) searchText a partir de name + telefone conhecido.
UPDATE public.team_whatsapp_contacts
SET
  "searchText" = lower(trim(concat_ws(' ', name, "phoneE164", "phoneNumber"))),
  "updatedAt" = now()
WHERE "searchText" IS NULL
   OR btrim("searchText") = '';

-- 6) Upsert de identities (não-GROUP), apontando para o canônico do E.164 quando existir.
WITH classified AS (
  SELECT
    c.id AS contact_row_id,
    c."teamId",
    c."remoteJid",
    cfg.id AS config_id,
    CASE
      WHEN lower(c."remoteJid") LIKE '%@g.us' THEN 'GROUP'
      WHEN lower(c."remoteJid") LIKE '%@lid' THEN 'LID'
      WHEN (
        lower(c."remoteJid") LIKE '%@s.whatsapp.net'
        OR lower(c."remoteJid") LIKE '%@c.us'
      )
      AND split_part(c."remoteJid", '@', 1) ~ '^\d{8,15}$'
        THEN 'PHONE'
      ELSE 'UNKNOWN'
    END AS identity_type,
    CASE
      WHEN (
        lower(c."remoteJid") LIKE '%@s.whatsapp.net'
        OR lower(c."remoteJid") LIKE '%@c.us'
      )
      AND split_part(c."remoteJid", '@', 1) ~ '^\d{8,15}$'
        THEN '+' || split_part(c."remoteJid", '@', 1)
      ELSE NULL
    END AS derived_phone
  FROM public.team_whatsapp_contacts c
  INNER JOIN public.team_whatsapp_configs cfg ON cfg."teamId" = c."teamId"
),
resolved AS (
  SELECT
    cl.*,
    coalesce(
      (
        SELECT existing.id
        FROM public.team_whatsapp_contacts existing
        WHERE cl.derived_phone IS NOT NULL
          AND existing."teamId" = cl."teamId"
          AND existing."phoneE164" = cl.derived_phone
        ORDER BY existing.id
        LIMIT 1
      ),
      cl.contact_row_id
    ) AS canonical_contact_id
  FROM classified cl
  WHERE cl.identity_type <> 'GROUP'
)
INSERT INTO public.whatsapp_contact_identities (
  id,
  "teamId",
  "configId",
  "contactId",
  "remoteJid",
  "identityType",
  "phoneE164",
  "mappingSource",
  "verifiedAt",
  sendable,
  "firstSeenAt",
  "lastSeenAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  r."teamId",
  r.config_id,
  r.canonical_contact_id,
  r."remoteJid",
  r.identity_type,
  CASE WHEN r.identity_type = 'PHONE' THEN r.derived_phone ELSE NULL END,
  'HISTORY',
  CASE WHEN r.identity_type = 'PHONE' THEN now() ELSE NULL END,
  (r.identity_type = 'PHONE'),
  now(),
  now(),
  now(),
  now()
FROM resolved r
ON CONFLICT ("teamId", "configId", "remoteJid") DO UPDATE
SET
  "contactId" = EXCLUDED."contactId",
  "identityType" = EXCLUDED."identityType",
  "phoneE164" = EXCLUDED."phoneE164",
  "mappingSource" = coalesce(public.whatsapp_contact_identities."mappingSource", EXCLUDED."mappingSource"),
  "verifiedAt" = coalesce(public.whatsapp_contact_identities."verifiedAt", EXCLUDED."verifiedAt"),
  sendable = EXCLUDED.sendable,
  "lastSeenAt" = now(),
  "updatedAt" = now();

-- 7) Vincular conversas sem contactId pelo externalChatId (= remoteJid legado).
UPDATE public.whatsapp_conversations AS conv
SET
  "contactId" = c.id,
  "updatedAt" = now()
FROM public.team_whatsapp_contacts c
WHERE conv."contactId" IS NULL
  AND conv."deletedAt" IS NULL
  AND conv."teamId" = c."teamId"
  AND conv."externalChatId" = c."remoteJid";

-- 7b) Preferir o canônico da identity quando a conversa ainda aponta para linha legada conflitante.
UPDATE public.whatsapp_conversations AS conv
SET
  "contactId" = i."contactId",
  "updatedAt" = now()
FROM public.whatsapp_contact_identities i
WHERE conv."teamId" = i."teamId"
  AND conv."externalChatId" = i."remoteJid"
  AND conv."deletedAt" IS NULL
  AND (conv."contactId" IS NULL OR conv."contactId" IS DISTINCT FROM i."contactId");
