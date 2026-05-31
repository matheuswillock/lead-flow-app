-- Add referral/indication fields to leads
ALTER TABLE public.corretor_studio_leads
  ADD COLUMN IF NOT EXISTS "isReferral" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "referrerLeadId" uuid,
  ADD COLUMN IF NOT EXISTS "referrerName" text,
  ADD COLUMN IF NOT EXISTS "referrerPhone" text;

-- Self-referential FK for referrer lead
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'corretor_studio_leads_referrer_lead_fkey'
  ) THEN
    ALTER TABLE public.corretor_studio_leads
      ADD CONSTRAINT corretor_studio_leads_referrer_lead_fkey
      FOREIGN KEY ("referrerLeadId")
      REFERENCES public.corretor_studio_leads(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for referrer lead lookups
CREATE INDEX IF NOT EXISTS corretor_studio_leads_referrer_lead_idx
  ON public.corretor_studio_leads ("referrerLeadId");

-- Partial index for referral filtering
CREATE INDEX IF NOT EXISTS corretor_studio_leads_is_referral_idx
  ON public.corretor_studio_leads ("isReferral")
  WHERE "isReferral" = true;
