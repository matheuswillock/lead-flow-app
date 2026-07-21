-- WhatsApp Inbox V2.2: retry scheduling, safe recovery and outbound reconciliation.
-- This table remains server-owned; no new Data API grants are introduced.

alter table public.whatsapp_webhook_events
  add column if not exists "nextAttemptAt" timestamptz,
  add column if not exists "processingStartedAt" timestamptz;

alter table public.whatsapp_outbound_commands
  add column if not exists "reconciledAt" timestamptz;

create index if not exists whatsapp_webhook_events_retry_idx
  on public.whatsapp_webhook_events (status, "nextAttemptAt", "createdAt");

-- Existing events are safe to retry as soon as the worker is deployed.
update public.whatsapp_webhook_events
set "nextAttemptAt" = coalesce("nextAttemptAt", "createdAt")
where status = 'PENDING';
