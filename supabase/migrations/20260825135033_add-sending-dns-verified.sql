-- EmailTeamSettings.resendSendingDnsVerified
--
-- Separa "DNS de envio verificado" (DKIM + SPF) de "domínio totalmente
-- verificado". `resendDomainStatus` colapsa os dois: um domínio com envio
-- íntegro e apenas o CNAME de tracking pendente fica `partially_failed`,
-- indistinguível de um com o DKIM quebrado. O gate de disparo precisa da
-- distinção — sem ela, um registro que só alimenta o pixel de abertura trava
-- todo o envio do time.
--
-- Derivado registro a registro em `syncFromResendDomain` (cron de 6h, webhook
-- de domínio e "Verificar DNS"). Nasce `false` para todos; enquanto não for
-- populado, o gate cai no fallback por `resendDomainStatus = 'verified'`.
--
-- SQL conferido contra `bun run db:migrate:from-prisma -- --dry-run`: é o único
-- `add column` que ele gera para esta mudança. O restante do preview daquele
-- comando é drift do Postgres local (118 de 326 migrations aplicadas, reset
-- indisponível) e foi descartado de propósito — replicá-lo dropava constraints
-- e triggers vigentes em produção.

ALTER TABLE "public"."email_team_settings"
  ADD COLUMN IF NOT EXISTS "resendSendingDnsVerified" boolean NOT NULL DEFAULT false;
