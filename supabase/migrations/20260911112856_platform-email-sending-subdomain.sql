ALTER TABLE public.email_team_settings
  ALTER COLUMN "fromEmail" SET DEFAULT 'contato@mail.corretorstudio.com';

UPDATE public.email_team_settings
SET
  "fromEmail" = 'contato@mail.corretorstudio.com',
  "updatedAt" = now()
WHERE lower("fromEmail") IN (
  'no-reply@corretorstudio.com',
  'deliveryby@corretorstudio.com',
  'contato@corretorstudio.com'
)
AND "resendDomainName" IS NULL;

-- O default de `EmailTeamSettings.fromEmail` é espelhado em
-- `email_team_senders` desde a migration `20260611005703` (backfill de 1 row
-- por time com `isDefault = true`). `resolveCampaignFrom` lê o sender default
-- ANTES de aplicar a normalização de legado (ver `defaultSender` em
-- `lib/email/resolve-campaign-from.ts`), então sem este UPDATE o time
-- continuaria disparando pelo endereço raiz aposentado apesar da migração
-- acima (achado do review automatizado no PR #1098).
UPDATE public.email_team_senders AS sender
SET
  "email" = 'contato@mail.corretorstudio.com',
  "updatedAt" = now()
FROM public.email_team_settings AS settings
WHERE sender."teamId" = settings."teamId"
  AND sender."isDefault" = TRUE
  AND lower(sender."email") IN (
    'no-reply@corretorstudio.com',
    'deliveryby@corretorstudio.com',
    'contato@corretorstudio.com'
  )
  AND settings."resendDomainName" IS NULL;
