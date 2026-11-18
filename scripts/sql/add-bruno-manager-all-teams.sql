-- Adiciona bruno@onsidemarketing.com.br como manager em todos os times ativos
-- do Corretor Studio em que ele ainda não é membro.
-- Membros já existentes NÃO são alterados (role, funções e permissões mantidas).
-- Idempotente: rodar de novo não duplica vínculos.

BEGIN;

DO $$
DECLARE
  v_email text := 'bruno@onsidemarketing.com.br';
  v_profile_id uuid;
  v_active_teams integer;
  v_inserted integer;
BEGIN
  SELECT p.id
  INTO v_profile_id
  FROM public.corretor_studio_profiles p
  WHERE p.email = v_email
    AND p."deletedAt" IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil existente para % não encontrado; nenhuma alteração feita.', v_email;
  END IF;

  SELECT count(*)
  INTO v_active_teams
  FROM public.corretor_studio_teams t
  WHERE t."deletedAt" IS NULL;

  INSERT INTO public.corretor_studio_team_members (
    id,
    "teamId",
    "profileId",
    role,
    functions,
    "canCreateAccountUsers",
    "canManageAccountTeams",
    "canTransferAccountLeads",
    "canViewAllTeams",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    t.id,
    v_profile_id,
    'manager'::"UserRole",
    ARRAY[]::"UserFunction"[],
    false,
    false,
    false,
    false,
    now(),
    now()
  FROM public.corretor_studio_teams t
  WHERE t."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.corretor_studio_team_members m
      WHERE m."teamId" = t.id
        AND m."profileId" = v_profile_id
    )
  ON CONFLICT ("teamId", "profileId") DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE 'Times ativos: %. Vínculos criados como manager: %. Já era membro (sem alteração): %.',
    v_active_teams, v_inserted, v_active_teams - v_inserted;
END
$$;

COMMIT;
