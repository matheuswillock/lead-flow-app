-- Add partially_sent value to email_campaign_status enum
-- This allows a parent campaign to reflect partial success when some sub-campaigns failed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'partially_sent'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_campaign_status')
  ) THEN
    ALTER TYPE "email_campaign_status" ADD VALUE 'partially_sent';
  END IF;
END $$;
