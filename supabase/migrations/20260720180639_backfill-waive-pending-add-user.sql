-- Backfill: aplica PendingActions add_user pendentes sem cobrança para masters
-- elegíveis a bypass (hasUnlimitedUsers / hasPermanentSubscription / Member PRO ativo).
-- Substitui scripts/backfill-waive-pending-add-user.ts no pipeline de migrations.
--
-- Limitações (mesmo escopo DB do applyAddUser):
-- - Não cancela cobranças Asaas via API (paymentId é limpo no apply).
-- - Não cria usuário no Supabase Auth nem envia convite.
-- - Não sincroniza assinatura Member PRO no Asaas.

DO $$
DECLARE
  r RECORD;
  v_team_id uuid;
  v_email text;
  v_name text;
  v_role public."UserRole";
  v_functions public."UserFunction"[];
  v_profile_id uuid;
  v_can_create_users boolean;
  v_can_manage_teams boolean;
  v_can_transfer_leads boolean;
  v_can_view_all_teams boolean;
  v_applied integer := 0;
  v_skipped integer := 0;
BEGIN
  FOR r IN
    SELECT
      pa.id,
      pa."masterId",
      pa."teamId",
      pa.payload,
      pa."createdAt"
    FROM public.corretor_studio_pending_actions pa
    JOIN public.corretor_studio_profiles m ON m.id = pa."masterId"
    WHERE pa."actionType" = 'add_user'
      AND pa.status = 'pending'
      AND (
        m."hasUnlimitedUsers" = true
        OR m."hasPermanentSubscription" = true
        OR EXISTS (
          SELECT 1
          FROM public.profile_user_type_assignments a
          JOIN public.profile_user_types t ON t.id = a."userTypeId"
          WHERE a."profileId" = m.id
            AND t.slug = 'member_pro'
            AND (a."accessExpiresAt" IS NULL OR a."accessExpiresAt" > now())
        )
      )
    ORDER BY pa."createdAt" ASC
  LOOP
    v_team_id := COALESCE(
      r."teamId",
      NULLIF(r.payload->>'teamId', '')::uuid
    );
    v_email := lower(trim(COALESCE(r.payload->>'email', '')));
    v_name := trim(COALESCE(r.payload->>'name', ''));

    BEGIN
      v_role := COALESCE(
        NULLIF(r.payload->>'role', '')::public."UserRole",
        'operator'::public."UserRole"
      );
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_role := 'operator'::public."UserRole";
    END;

    BEGIN
      SELECT COALESCE(array_agg(f::public."UserFunction"), ARRAY[]::public."UserFunction"[])
      INTO v_functions
      FROM jsonb_array_elements_text(COALESCE(r.payload->'functions', '[]'::jsonb)) AS f;
    EXCEPTION
      WHEN others THEN
        v_functions := ARRAY[]::public."UserFunction"[];
    END;

    IF v_team_id IS NULL OR v_email = '' OR v_name = '' THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE 'skip add_user pending=%: dados insuficientes', r.id;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.corretor_studio_teams t WHERE t.id = v_team_id
    ) THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE 'skip add_user pending=%: team % inexistente', r.id, v_team_id;
      CONTINUE;
    END IF;

    v_can_create_users :=
      v_role = 'manager'
      AND COALESCE((r.payload->>'canCreateAccountUsers')::boolean, false);
    v_can_manage_teams :=
      v_role = 'manager'
      AND COALESCE((r.payload->>'canManageAccountTeams')::boolean, false);
    v_can_transfer_leads :=
      v_role IN ('manager', 'backoffice')
      AND COALESCE((r.payload->>'canTransferAccountLeads')::boolean, false);
    v_can_view_all_teams :=
      v_role IN ('manager', 'backoffice')
      AND COALESCE((r.payload->>'canViewAllTeams')::boolean, false);

    SELECT p.id
    INTO v_profile_id
    FROM public.corretor_studio_profiles p
    WHERE lower(p.email) = v_email
    LIMIT 1;

    IF v_profile_id IS NULL THEN
      v_profile_id := gen_random_uuid();
      INSERT INTO public.corretor_studio_profiles (
        id,
        email,
        "fullName",
        role,
        functions,
        "isMaster",
        "managerId",
        "createdAt",
        "updatedAt"
      ) VALUES (
        v_profile_id,
        v_email,
        v_name,
        v_role,
        v_functions,
        false,
        r."masterId",
        now(),
        now()
      );
    ELSE
      UPDATE public.corretor_studio_profiles
      SET
        "fullName" = v_name,
        "managerId" = r."masterId",
        "updatedAt" = now()
      WHERE id = v_profile_id;
    END IF;

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
    ) VALUES (
      gen_random_uuid(),
      v_team_id,
      v_profile_id,
      v_role,
      v_functions,
      v_can_create_users,
      v_can_manage_teams,
      v_can_transfer_leads,
      v_can_view_all_teams,
      now(),
      now()
    )
    ON CONFLICT ("teamId", "profileId") DO UPDATE SET
      role = EXCLUDED.role,
      functions = EXCLUDED.functions,
      "canCreateAccountUsers" = EXCLUDED."canCreateAccountUsers",
      "canManageAccountTeams" = EXCLUDED."canManageAccountTeams",
      "canTransferAccountLeads" = EXCLUDED."canTransferAccountLeads",
      "canViewAllTeams" = EXCLUDED."canViewAllTeams",
      "updatedAt" = now();

    UPDATE public.corretor_studio_pending_actions
    SET
      status = 'applied',
      "paymentId" = NULL,
      "teamId" = v_team_id,
      payload = r.payload
        || jsonb_build_object(
          'paymentStatus', 'WAIVED',
          'waivedReason', 'unlimited_users_backfill',
          'waivedAt', to_jsonb(now())
        ),
      "updatedAt" = now()
    WHERE id = r.id
      AND status = 'pending';

    v_applied := v_applied + 1;
    RAISE NOTICE 'applied add_user pending=% profile=% team=%', r.id, v_profile_id, v_team_id;
  END LOOP;

  RAISE NOTICE 'backfill-waive-pending-add-user done applied=% skipped=%', v_applied, v_skipped;
END $$;
