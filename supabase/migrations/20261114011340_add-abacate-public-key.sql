ALTER TABLE public.payment_provider_configs
  ADD COLUMN IF NOT EXISTS public_key text;
