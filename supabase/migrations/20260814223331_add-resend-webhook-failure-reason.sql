-- Fase 4 / PR2.1 (resend-webhook-emaillog-queue): failureReason estruturado
-- para auditoria do outbox de fallback do webhook Resend (queue_publish_failed
-- vs semaphore_saturated), separado da mensagem de erro crua em lastError.
alter table "public"."corretor_studio_resend_webhook_processing_failures"
  add column if not exists "failureReason" text;
