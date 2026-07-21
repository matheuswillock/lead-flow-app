-- Idempotent: backoffice lead public offers (expirable share links)

CREATE TABLE IF NOT EXISTS "public"."backoffice_lead_offers" (
  "id" uuid NOT NULL,
  "leadId" uuid NOT NULL,
  "leadNameSnapshot" text NOT NULL,
  "contactName" text NOT NULL,
  "contactPhone" text NOT NULL,
  "itemsJson" jsonb NOT NULL,
  "shareTokenHash" text NOT NULL,
  "shareExpiresAt" timestamp(6) with time zone NOT NULL,
  "shareGeneratedAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "shareGeneratedByProfileId" uuid,
  "revokedAt" timestamp(6) with time zone,
  "createdAt" timestamp(6) with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(6) with time zone NOT NULL,
  CONSTRAINT "backoffice_lead_offers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_lead_offers_shareTokenHash_key"
  ON public.backoffice_lead_offers USING btree ("shareTokenHash");

CREATE INDEX IF NOT EXISTS "backoffice_lead_offers_lead_id_idx"
  ON public.backoffice_lead_offers USING btree ("leadId");

CREATE INDEX IF NOT EXISTS "backoffice_lead_offers_share_expires_at_idx"
  ON public.backoffice_lead_offers USING btree ("shareExpiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_lead_offers_leadId_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_lead_offers"
      ADD CONSTRAINT "backoffice_lead_offers_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES public.backoffice_leads(id)
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'backoffice_lead_offers_shareGeneratedByProfileId_fkey'
  ) THEN
    ALTER TABLE "public"."backoffice_lead_offers"
      ADD CONSTRAINT "backoffice_lead_offers_shareGeneratedByProfileId_fkey"
      FOREIGN KEY ("shareGeneratedByProfileId") REFERENCES public.corretor_studio_profiles(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."backoffice_lead_offers" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."backoffice_lead_offers" TO "authenticated";

ALTER TABLE "public"."backoffice_lead_offers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backoffice_lead_offers_select ON public.backoffice_lead_offers;
CREATE POLICY backoffice_lead_offers_select ON public.backoffice_lead_offers
  FOR SELECT TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_lead_offers_insert ON public.backoffice_lead_offers;
CREATE POLICY backoffice_lead_offers_insert ON public.backoffice_lead_offers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_lead_offers_update ON public.backoffice_lead_offers;
CREATE POLICY backoffice_lead_offers_update ON public.backoffice_lead_offers
  FOR UPDATE TO authenticated
  USING (public.is_active_backoffice_user());

DROP POLICY IF EXISTS backoffice_lead_offers_delete ON public.backoffice_lead_offers;
CREATE POLICY backoffice_lead_offers_delete ON public.backoffice_lead_offers
  FOR DELETE TO authenticated
  USING (public.is_active_backoffice_user());
