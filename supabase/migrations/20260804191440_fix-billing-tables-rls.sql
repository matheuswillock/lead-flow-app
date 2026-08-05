-- Estágio -1 (D0 / C-1): RLS em tabelas de billing / tipo de usuário.
--
-- Application access today is via the Prisma service-role client, which bypasses RLS.
-- These policies close client-side exposure for anon/authenticated while leaving
-- service_role / Prisma paths unchanged.

-- asaas_webhook_events: no permissive policies (service_role/Prisma only).
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- profile_user_types: catalog is readable by authenticated users; writes via service role.
ALTER TABLE public.profile_user_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_user_types_select_authenticated" ON public.profile_user_types;
CREATE POLICY "profile_user_types_select_authenticated"
  ON public.profile_user_types
  FOR SELECT
  TO authenticated
  USING (true);

-- profile_user_type_assignments: own profile only for SELECT; writes via service role.
ALTER TABLE public.profile_user_type_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_user_type_assignments_select_own" ON public.profile_user_type_assignments;
CREATE POLICY "profile_user_type_assignments_select_own"
  ON public.profile_user_type_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.corretor_studio_profiles p
      WHERE p.id = profile_user_type_assignments."profileId"
        AND (p."supabaseId" = auth.uid() OR p.id = auth.uid())
    )
  );
