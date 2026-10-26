-- Fase 5: tipos de notificação para auditoria DNS do Studio.
-- Apenas altera o enum; a migration não aplica dados nem políticas.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'STUDIO_DOMAIN_DNS_ACTION_REQUIRED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'STUDIO_DOMAIN_DNS_RECOVERED';
