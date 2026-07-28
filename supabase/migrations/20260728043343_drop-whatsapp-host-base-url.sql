-- WhatsApp Inbox V3 Fase 4 (T4.6): remove legado hostBaseUrl.
-- Idempotente. Inventário/rotação EVO_API_KEY permanece ops.

ALTER TABLE public.team_whatsapp_configs
  DROP COLUMN IF EXISTS "hostBaseUrl";
