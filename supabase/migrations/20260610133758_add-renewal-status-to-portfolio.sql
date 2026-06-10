DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'renewal_status') THEN
    CREATE TYPE "public"."renewal_status" AS ENUM ('to_renew', 'contacted', 'proposal', 'renewed', 'lost');
  END IF;
END $$;

ALTER TABLE "public"."corretor_studio_lead_portfolio"
  ADD COLUMN IF NOT EXISTS "renewalStatus" public.renewal_status NOT NULL DEFAULT 'to_renew'::public.renewal_status;
