-- Backoffice email dispatch tracking (transactional + Google Calendar)

DO $$ BEGIN
  CREATE TYPE public.backoffice_email_dispatch_provider AS ENUM ('resend', 'google_calendar');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.backoffice_email_recipient_kind AS ENUM ('account', 'google', 'external');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.backoffice_email_dispatch_category AS ENUM (
    'access_invite',
    'access_reset',
    'invoice_notification',
    'adhesion_invite',
    'schedule_invite',
    'welcome',
    'operator_invite',
    'meeting_invite',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.backoffice_email_dispatch_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'failed',
    'delivery_delayed',
    'suppressed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.backoffice_email_dispatch_event_type AS ENUM (
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'delivery_delayed',
    'unsubscribed',
    'suppressed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.backoffice_email_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" uuid NOT NULL REFERENCES public.corretor_studio_profiles(id) ON DELETE CASCADE,
  "recipientEmail" text NOT NULL,
  "recipientKind" public.backoffice_email_recipient_kind NOT NULL,
  provider public.backoffice_email_dispatch_provider NOT NULL,
  category public.backoffice_email_dispatch_category NOT NULL,
  subject text NOT NULL,
  status public.backoffice_email_dispatch_status NOT NULL DEFAULT 'queued',
  "resendEmailId" text UNIQUE,
  "sourceType" text,
  "sourceId" text,
  "errorMessage" text,
  "sentAt" timestamptz,
  "deliveredAt" timestamptz,
  "openedAt" timestamptz,
  "clickedAt" timestamptz,
  "bouncedAt" timestamptz,
  "complainedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backoffice_email_dispatches_profile_created_idx
  ON public.backoffice_email_dispatches ("profileId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS backoffice_email_dispatches_profile_status_idx
  ON public.backoffice_email_dispatches ("profileId", status);

CREATE INDEX IF NOT EXISTS backoffice_email_dispatches_recipient_email_idx
  ON public.backoffice_email_dispatches ("recipientEmail");

CREATE INDEX IF NOT EXISTS backoffice_email_dispatches_resend_email_id_idx
  ON public.backoffice_email_dispatches ("resendEmailId");

CREATE TABLE IF NOT EXISTS public.backoffice_email_dispatch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dispatchId" uuid NOT NULL REFERENCES public.backoffice_email_dispatches(id) ON DELETE CASCADE,
  type public.backoffice_email_dispatch_event_type NOT NULL,
  "occurredAt" timestamptz NOT NULL,
  metadata jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backoffice_email_dispatch_events_dispatch_occurred_idx
  ON public.backoffice_email_dispatch_events ("dispatchId", "occurredAt" DESC);

ALTER TABLE public.backoffice_email_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backoffice_email_dispatch_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "backoffice_email_dispatches_select" ON public.backoffice_email_dispatches
    FOR SELECT TO authenticated
    USING (public.is_active_backoffice_user());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_email_dispatches_insert" ON public.backoffice_email_dispatches
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_backoffice_user());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_email_dispatches_update" ON public.backoffice_email_dispatches
    FOR UPDATE TO authenticated
    USING (public.is_active_backoffice_user());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_email_dispatch_events_select" ON public.backoffice_email_dispatch_events
    FOR SELECT TO authenticated
    USING (public.is_active_backoffice_user());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "backoffice_email_dispatch_events_insert" ON public.backoffice_email_dispatch_events
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_backoffice_user());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
