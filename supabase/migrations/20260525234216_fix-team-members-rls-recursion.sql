-- Fix P0: infinite recursion (42P17) in corretor_studio_team_members RLS policies.
--
-- The previous policies queried corretor_studio_team_members from within the same
-- table's own RLS predicate, causing PostgreSQL to recurse infinitely.
--
-- Fix: SECURITY DEFINER helper functions bypass RLS when evaluating membership,
-- breaking the cycle. The policies then call these functions instead of
-- self-referencing the table directly.

-- ─── Drop recursive policies ─────────────────────────────────────────────────
drop policy if exists "team_members_select" on public.corretor_studio_team_members;
drop policy if exists "team_members_insert" on public.corretor_studio_team_members;
drop policy if exists "team_members_update" on public.corretor_studio_team_members;
drop policy if exists "team_members_delete" on public.corretor_studio_team_members;

-- ─── Helper: is the current user a member of the given team? ─────────────────
create or replace function public.corretor_studio_is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.corretor_studio_team_members tm
    join public.corretor_studio_profiles p on p.id = tm."profileId"
    where tm."teamId" = p_team_id
      and (p."supabaseId" = auth.uid() or p.id = auth.uid())
  );
$$;

-- ─── Helper: is the current user a manager of the given team? ────────────────
create or replace function public.corretor_studio_is_team_manager(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.corretor_studio_team_members tm
    join public.corretor_studio_profiles p on p.id = tm."profileId"
    where tm."teamId" = p_team_id
      and tm.role = 'manager'
      and (p."supabaseId" = auth.uid() or p.id = auth.uid())
  );
$$;

-- ─── Recreate policies using SECURITY DEFINER helpers ────────────────────────
create policy "team_members_select"
  on public.corretor_studio_team_members for select to authenticated
  using (
    public.corretor_studio_is_team_member("teamId")
  );

create policy "team_members_insert"
  on public.corretor_studio_team_members for insert to authenticated
  with check (
    public.corretor_studio_is_team_manager("teamId")
  );

create policy "team_members_update"
  on public.corretor_studio_team_members for update to authenticated
  using (
    public.corretor_studio_is_team_manager("teamId")
  );

create policy "team_members_delete"
  on public.corretor_studio_team_members for delete to authenticated
  using (
    public.corretor_studio_is_team_manager("teamId")
  );
