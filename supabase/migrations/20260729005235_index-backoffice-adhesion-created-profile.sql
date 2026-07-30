CREATE INDEX IF NOT EXISTS backoffice_adhesions_created_profile_id_created_at_idx
  ON public.backoffice_adhesions ("createdProfileId", "createdAt" DESC);
