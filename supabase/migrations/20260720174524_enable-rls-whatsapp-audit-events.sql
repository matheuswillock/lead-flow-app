-- Restrict WhatsApp audit events to service_role (Prisma) — no Data API access for anon/authenticated.
ALTER TABLE public.whatsapp_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.whatsapp_audit_events FROM anon, authenticated;

GRANT ALL ON TABLE public.whatsapp_audit_events TO service_role;
