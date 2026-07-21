-- Dialer module (Studio Voice): modo de integracao 3C Plus (Decisao A do docs/DIALER_SPEC.md).
-- Os dois caminhos coexistem por Time: "master" (credencial de aplicacao, conta unica do
-- Corretor Studio) e "own_account" (Time conecta a propria conta 3C Plus, credencial cifrada).

-- ============================================
-- Enums
-- ============================================

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'dialer_3cplus_mode' and n.nspname = 'public') then
    create type "public"."dialer_3cplus_mode" as enum ('master', 'own_account');
  end if;
end
$$;

-- ============================================
-- Campos novos em corretor_studio_teams
-- ============================================

alter table "public"."corretor_studio_teams"
  add column if not exists "dialer3cplusMode" public.dialer_3cplus_mode not null default 'master'::public.dialer_3cplus_mode,
  add column if not exists "dialer3cplusAccountId" text,
  add column if not exists "dialer3cplusApiToken" text;
