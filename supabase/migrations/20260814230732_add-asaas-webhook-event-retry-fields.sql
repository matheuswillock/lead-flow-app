-- Fase 4 / PR2.2 (asaas-webhook-queue): campos de retry (attemptCount,
-- nextAttemptAt) e failureReason estruturado para o outbox nativo de
-- AsaasWebhookEvent, mesma lógica já usada em ResendWebhookProcessingFailure.
alter table "public"."asaas_webhook_events"
  add column if not exists "attemptCount" integer not null default 0;

alter table "public"."asaas_webhook_events"
  add column if not exists "nextAttemptAt" timestamptz not null default now();

alter table "public"."asaas_webhook_events"
  add column if not exists "failureReason" text;

create index if not exists "asaas_webhook_events_status_next_attempt_at_idx"
  on "public"."asaas_webhook_events" ("status", "nextAttemptAt");
