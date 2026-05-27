-- Permite que supabase_auth_admin leia corretor_studio_profiles
-- Necessário para o Auth Hook hook_restrict_signup funcionar corretamente
-- em produção ao disparar inviteUserByEmail.
GRANT SELECT ON TABLE public.corretor_studio_profiles TO supabase_auth_admin;
