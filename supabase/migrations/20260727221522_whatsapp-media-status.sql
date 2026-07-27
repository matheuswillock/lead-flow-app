-- WhatsApp Inbox V3 Fase 3 — status de mídia e campos de ingestão durável.
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'WhatsAppMediaStatus' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public."WhatsAppMediaStatus" AS ENUM (
      'PROCESSING',
      'AVAILABLE',
      'EXPIRED',
      'FAILED'
    );
  END IF;
END $$;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS "mediaStatus" public."WhatsAppMediaStatus",
  ADD COLUMN IF NOT EXISTS "mediaAttemptCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mediaLastErrorCode" text,
  ADD COLUMN IF NOT EXISTS "mediaRetrievedAt" timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_messages_media_ingest_idx
  ON public.whatsapp_messages ("mediaStatus", "mediaAttemptCount", "updatedAt");
