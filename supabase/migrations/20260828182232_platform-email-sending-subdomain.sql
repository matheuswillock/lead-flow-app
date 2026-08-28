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
