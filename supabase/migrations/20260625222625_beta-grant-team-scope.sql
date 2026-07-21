-- Beta grant team scope: ALL_TEAMS | SPECIFIC_TEAMS

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backoffice_beta_team_scope') THEN
    CREATE TYPE public.backoffice_beta_team_scope AS ENUM ('ALL_TEAMS', 'SPECIFIC_TEAMS');
  END IF;
END $$;

ALTER TABLE public.backoffice_feature_grants
  ADD COLUMN IF NOT EXISTS "betaTeamScope" public.backoffice_beta_team_scope NOT NULL DEFAULT 'ALL_TEAMS';

CREATE TABLE IF NOT EXISTS public.backoffice_feature_grant_teams (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "grantId" uuid NOT NULL,
  "teamId" uuid NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT backoffice_feature_grant_teams_pkey PRIMARY KEY ("id"),
  CONSTRAINT backoffice_feature_grant_teams_grant_id_fkey
    FOREIGN KEY ("grantId") REFERENCES public.backoffice_feature_grants("id") ON DELETE CASCADE,
  CONSTRAINT backoffice_feature_grant_teams_team_id_fkey
    FOREIGN KEY ("teamId") REFERENCES public.corretor_studio_teams("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS backoffice_feature_grant_teams_grant_team_key
  ON public.backoffice_feature_grant_teams ("grantId", "teamId");

CREATE INDEX IF NOT EXISTS backoffice_feature_grant_teams_grant_id_idx
  ON public.backoffice_feature_grant_teams ("grantId");

CREATE INDEX IF NOT EXISTS backoffice_feature_grant_teams_team_id_idx
  ON public.backoffice_feature_grant_teams ("teamId");

-- Legacy: deactivate beta grants on non-master profiles
UPDATE public.backoffice_feature_grants g
SET "isActive" = false, "updatedAt" = now()
FROM public.corretor_studio_profiles p
WHERE g."profileId" = p.id
  AND p."isMaster" = false
  AND g."grantType" = 'BETA'
  AND g."isActive" = true;
