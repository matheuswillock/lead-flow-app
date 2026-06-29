-- Optional reference seed: Bruno as initial sponsor profile lookup.
-- Does not assign associate accounts automatically; documents intended initial patron.
-- Idempotent: no-op when profile email is absent in the environment.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.corretor_studio_profiles
    WHERE lower(email) = lower('bruno@onseidemarketing.com.br')
  ) THEN
    RAISE NOTICE 'Bruno sponsor profile exists (bruno@onseidemarketing.com.br). Assign associate accounts via backoffice admin.';
  END IF;
END $$;
