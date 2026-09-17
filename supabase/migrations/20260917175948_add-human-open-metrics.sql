-- Métricas de abertura em duas camadas (aberturas reais vs. brutas).
--
-- `humanOpenedAt`: primeiro open classificado como HUMANO pelo classificador
-- de origem do webhook (lib/email/email-event-origin-classifier.ts).
-- `openedAt` continua bruto — qualquer open (inclusive proxy do provedor)
-- reivindica — preservando a semântica exatamente-uma-vez existente.
--
-- `totalOpenedHuman` em campanha/disparo espelha `totalOpened`: sobe no
-- máximo 1 por destinatário, no claim atômico de `EmailLog.humanOpenedAt`.
--
-- Nomes físicos conferidos com @@map em prisma/schema.prisma:
--   EmailCampaign         -> corretor_studio_email_campaigns
--   EmailCampaignDispatch -> corretor_studio_email_campaign_dispatches
--   EmailLog              -> corretor_studio_email_logs

alter table "public"."corretor_studio_email_campaign_dispatches"
  add column if not exists "totalOpenedHuman" integer not null default 0;

alter table "public"."corretor_studio_email_campaigns"
  add column if not exists "totalOpenedHuman" integer not null default 0;

alter table "public"."corretor_studio_email_logs"
  add column if not exists "humanOpenedAt" timestamp(6) with time zone;

-- Paridade com corretor_studio_email_logs_team_opened_idx: o analytics ancora
-- range de fato no timestamp de cada evento (SPEC 30 — D5) e os segmentos de
-- engajamento passam a filtrar por abertura humana.
create index if not exists corretor_studio_email_logs_team_human_opened_idx
  on public.corretor_studio_email_logs using btree ("teamId", "humanOpenedAt");
