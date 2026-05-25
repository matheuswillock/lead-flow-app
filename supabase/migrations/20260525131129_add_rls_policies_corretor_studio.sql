-- RLS policies for all corretor_studio_* tables that have RLS enabled but no policies.
-- Tables corretor_studio_lead_activities, corretor_studio_lead_activity_reactions, and
-- corretor_studio_profiles already have realtime SELECT policies — this migration adds
-- the remaining DML policies for those three, and full SELECT+DML for the rest.
--
-- Access model:
--   team-scoped  → authenticated user must be a member of the row's team
--   profile-scoped → authenticated user must own the profile
--   global-read  → any authenticated user can SELECT (e.g. health_plan_options)
--   child tables  → access inherited via parent (lead_finalized_*, email_*, etc.)

-- ─── corretor_studio_teams ───────────────────────────────────────────────────
create policy "teams_select"
  on public.corretor_studio_teams for select to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where tm."teamId" = corretor_studio_teams.id
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "teams_insert"
  on public.corretor_studio_teams for insert to authenticated
  with check (
    exists (
      select 1 from public.corretor_studio_profiles p
      where (p."supabaseId" = auth.uid() or p.id = auth.uid())
        and p.id = corretor_studio_teams."masterId"
    )
  );

create policy "teams_update"
  on public.corretor_studio_teams for update to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where tm."teamId" = corretor_studio_teams.id
        and tm.role = 'manager'
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "teams_delete"
  on public.corretor_studio_teams for delete to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_profiles p
      where p.id = corretor_studio_teams."masterId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

-- ─── corretor_studio_team_members ────────────────────────────────────────────
create policy "team_members_select"
  on public.corretor_studio_team_members for select to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm2
      join public.corretor_studio_profiles p on p.id = tm2."profileId"
      where tm2."teamId" = corretor_studio_team_members."teamId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "team_members_insert"
  on public.corretor_studio_team_members for insert to authenticated
  with check (
    exists (
      select 1 from public.corretor_studio_team_members tm2
      join public.corretor_studio_profiles p on p.id = tm2."profileId"
      where tm2."teamId" = corretor_studio_team_members."teamId"
        and tm2.role = 'manager'
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "team_members_update"
  on public.corretor_studio_team_members for update to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm2
      join public.corretor_studio_profiles p on p.id = tm2."profileId"
      where tm2."teamId" = corretor_studio_team_members."teamId"
        and tm2.role = 'manager'
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "team_members_delete"
  on public.corretor_studio_team_members for delete to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm2
      join public.corretor_studio_profiles p on p.id = tm2."profileId"
      where tm2."teamId" = corretor_studio_team_members."teamId"
        and tm2.role = 'manager'
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

-- ─── corretor_studio_profiles (DML — SELECT already exists as realtime policy)
create policy "profiles_insert"
  on public.corretor_studio_profiles for insert to authenticated
  with check (
    "supabaseId" = auth.uid() or id = auth.uid()
  );

create policy "profiles_update"
  on public.corretor_studio_profiles for update to authenticated
  using (
    "supabaseId" = auth.uid() or id = auth.uid()
  );

create policy "profiles_delete"
  on public.corretor_studio_profiles for delete to authenticated
  using (
    "supabaseId" = auth.uid() or id = auth.uid()
  );

-- ─── corretor_studio_leads ───────────────────────────────────────────────────
create policy "leads_select"
  on public.corretor_studio_leads for select to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where tm."teamId" = corretor_studio_leads."teamId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "leads_insert"
  on public.corretor_studio_leads for insert to authenticated
  with check (
    exists (
      select 1 from public.corretor_studio_team_members tm
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where tm."teamId" = corretor_studio_leads."teamId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "leads_update"
  on public.corretor_studio_leads for update to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where tm."teamId" = corretor_studio_leads."teamId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "leads_delete"
  on public.corretor_studio_leads for delete to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_team_members tm
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where tm."teamId" = corretor_studio_leads."teamId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

-- ─── corretor_studio_leads_schedule ──────────────────────────────────────────
create policy "leads_schedule_select"
  on public.corretor_studio_leads_schedule for select to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_leads_schedule."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "leads_schedule_insert"
  on public.corretor_studio_leads_schedule for insert to authenticated
  with check (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_leads_schedule."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "leads_schedule_update"
  on public.corretor_studio_leads_schedule for update to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_leads_schedule."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "leads_schedule_delete"
  on public.corretor_studio_leads_schedule for delete to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_leads_schedule."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

-- ─── corretor_studio_lead_activities (DML — SELECT already exists) ────────────
create policy "lead_activities_insert"
  on public.corretor_studio_lead_activities for insert to authenticated
  with check (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_lead_activities."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "lead_activities_update"
  on public.corretor_studio_lead_activities for update to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_lead_activities."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "lead_activities_delete"
  on public.corretor_studio_lead_activities for delete to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_lead_activities."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

-- ─── corretor_studio_lead_activity_reactions (DML — SELECT already exists) ───
create policy "lead_activity_reactions_insert"
  on public.corretor_studio_lead_activity_reactions for insert to authenticated
  with check (
    exists (
      select 1 from public.corretor_studio_lead_activities la
      join public.corretor_studio_leads l on l.id = la."leadId"
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where la.id = corretor_studio_lead_activity_reactions."activityId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "lead_activity_reactions_update"
  on public.corretor_studio_lead_activity_reactions for update to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_lead_activities la
      join public.corretor_studio_leads l on l.id = la."leadId"
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where la.id = corretor_studio_lead_activity_reactions."activityId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

create policy "lead_activity_reactions_delete"
  on public.corretor_studio_lead_activity_reactions for delete to authenticated
  using (
    exists (
      select 1 from public.corretor_studio_lead_activities la
      join public.corretor_studio_leads l on l.id = la."leadId"
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where la.id = corretor_studio_lead_activity_reactions."activityId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );

-- ─── corretor_studio_lead_attachments ────────────────────────────────────────
create policy "lead_attachments_select" on public.corretor_studio_lead_attachments for select to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_attachments."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_attachments_insert" on public.corretor_studio_lead_attachments for insert to authenticated with check (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_attachments."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_attachments_update" on public.corretor_studio_lead_attachments for update to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_attachments."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_attachments_delete" on public.corretor_studio_lead_attachments for delete to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_attachments."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── corretor_studio_lead_finalized ──────────────────────────────────────────
create policy "lead_finalized_select" on public.corretor_studio_lead_finalized for select to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_finalized."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_insert" on public.corretor_studio_lead_finalized for insert to authenticated with check (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_finalized."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_update" on public.corretor_studio_lead_finalized for update to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_finalized."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_delete" on public.corretor_studio_lead_finalized for delete to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_lead_finalized."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── corretor_studio_lead_finalized_holders ──────────────────────────────────
create policy "lead_finalized_holders_select" on public.corretor_studio_lead_finalized_holders for select to authenticated using (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_holders."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_holders_insert" on public.corretor_studio_lead_finalized_holders for insert to authenticated with check (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_holders."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_holders_update" on public.corretor_studio_lead_finalized_holders for update to authenticated using (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_holders."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_holders_delete" on public.corretor_studio_lead_finalized_holders for delete to authenticated using (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_holders."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── corretor_studio_lead_finalized_dependents ───────────────────────────────
create policy "lead_finalized_dependents_select" on public.corretor_studio_lead_finalized_dependents for select to authenticated using (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_dependents."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_dependents_insert" on public.corretor_studio_lead_finalized_dependents for insert to authenticated with check (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_dependents."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_dependents_update" on public.corretor_studio_lead_finalized_dependents for update to authenticated using (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_dependents."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_finalized_dependents_delete" on public.corretor_studio_lead_finalized_dependents for delete to authenticated using (exists (select 1 from public.corretor_studio_lead_finalized lf join public.corretor_studio_leads l on l.id=lf."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where lf.id=corretor_studio_lead_finalized_dependents."leadFinalizedId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── corretor_studio_lead_portfolio ──────────────────────────────────────────
create policy "lead_portfolio_select" on public.corretor_studio_lead_portfolio for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_lead_portfolio."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_portfolio_insert" on public.corretor_studio_lead_portfolio for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_lead_portfolio."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_portfolio_update" on public.corretor_studio_lead_portfolio for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_lead_portfolio."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "lead_portfolio_delete" on public.corretor_studio_lead_portfolio for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_lead_portfolio."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── corretor_studio_tasks ───────────────────────────────────────────────────
create policy "tasks_select" on public.corretor_studio_tasks for select to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_tasks."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "tasks_insert" on public.corretor_studio_tasks for insert to authenticated with check (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_tasks."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "tasks_update" on public.corretor_studio_tasks for update to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_tasks."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "tasks_delete" on public.corretor_studio_tasks for delete to authenticated using (exists (select 1 from public.corretor_studio_leads l join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where l.id=corretor_studio_tasks."leadId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── corretor_studio_task_assignees ──────────────────────────────────────────
create policy "task_assignees_select" on public.corretor_studio_task_assignees for select to authenticated using (exists (select 1 from public.corretor_studio_tasks t join public.corretor_studio_leads l on l.id=t."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where t.id=corretor_studio_task_assignees."taskId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "task_assignees_insert" on public.corretor_studio_task_assignees for insert to authenticated with check (exists (select 1 from public.corretor_studio_tasks t join public.corretor_studio_leads l on l.id=t."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where t.id=corretor_studio_task_assignees."taskId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "task_assignees_update" on public.corretor_studio_task_assignees for update to authenticated using (exists (select 1 from public.corretor_studio_tasks t join public.corretor_studio_leads l on l.id=t."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where t.id=corretor_studio_task_assignees."taskId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "task_assignees_delete" on public.corretor_studio_task_assignees for delete to authenticated using (exists (select 1 from public.corretor_studio_tasks t join public.corretor_studio_leads l on l.id=t."leadId" join public.corretor_studio_team_members tm on tm."teamId"=l."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where t.id=corretor_studio_task_assignees."taskId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── team config tables ───────────────────────────────────────────────────────
create policy "team_filter_presets_select" on public.corretor_studio_team_filter_presets for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_filter_presets."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_filter_presets_insert" on public.corretor_studio_team_filter_presets for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_filter_presets."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_filter_presets_update" on public.corretor_studio_team_filter_presets for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_filter_presets."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_filter_presets_delete" on public.corretor_studio_team_filter_presets for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_filter_presets."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "team_status_rules_select" on public.corretor_studio_team_status_rules for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_status_rules."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_status_rules_insert" on public.corretor_studio_team_status_rules for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_status_rules."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_status_rules_update" on public.corretor_studio_team_status_rules for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_status_rules."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_status_rules_delete" on public.corretor_studio_team_status_rules for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_status_rules."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "team_studio_webhook_configs_select" on public.corretor_studio_team_studio_webhook_configs for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_studio_webhook_configs."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_studio_webhook_configs_insert" on public.corretor_studio_team_studio_webhook_configs for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_studio_webhook_configs."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_studio_webhook_configs_update" on public.corretor_studio_team_studio_webhook_configs for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_studio_webhook_configs."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "team_studio_webhook_configs_delete" on public.corretor_studio_team_studio_webhook_configs for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_studio_webhook_configs."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "team_studio_webhook_request_logs_select" on public.corretor_studio_team_studio_webhook_request_logs for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_team_studio_webhook_request_logs."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── notifications ────────────────────────────────────────────────────────────
create policy "notifications_select" on public.corretor_studio_notifications for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_notifications."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "notifications_insert" on public.corretor_studio_notifications for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_notifications."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "notifications_update" on public.corretor_studio_notifications for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_notifications."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "notifications_delete" on public.corretor_studio_notifications for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_notifications."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── pending tables ───────────────────────────────────────────────────────────
create policy "pending_actions_select" on public.corretor_studio_pending_actions for select to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_pending_actions."masterId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())) or exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_pending_actions."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "pending_actions_insert" on public.corretor_studio_pending_actions for insert to authenticated with check (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_pending_actions."masterId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "pending_actions_update" on public.corretor_studio_pending_actions for update to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_pending_actions."masterId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "pending_actions_delete" on public.corretor_studio_pending_actions for delete to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_pending_actions."masterId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "pending_operators_select" on public.corretor_studio_pending_operators for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_pending_operators."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "pending_operators_insert" on public.corretor_studio_pending_operators for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_pending_operators."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "pending_operators_update" on public.corretor_studio_pending_operators for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_pending_operators."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "pending_operators_delete" on public.corretor_studio_pending_operators for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_pending_operators."teamId" and tm.role='manager' and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── profile_subscriptions ───────────────────────────────────────────────────
create policy "profile_subscriptions_select" on public.corretor_studio_profile_subscriptions for select to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_profile_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "profile_subscriptions_insert" on public.corretor_studio_profile_subscriptions for insert to authenticated with check (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_profile_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "profile_subscriptions_update" on public.corretor_studio_profile_subscriptions for update to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_profile_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "profile_subscriptions_delete" on public.corretor_studio_profile_subscriptions for delete to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_profile_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── profile_subscription_capacities ─────────────────────────────────────────
create policy "profile_subscription_capacities_select" on public.corretor_studio_profile_subscription_capacities for select to authenticated using (exists (select 1 from public.corretor_studio_profile_subscriptions ps join public.corretor_studio_profiles p on p.id=ps."profileId" where ps.id=corretor_studio_profile_subscription_capacities."profileSubscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "profile_subscription_capacities_insert" on public.corretor_studio_profile_subscription_capacities for insert to authenticated with check (exists (select 1 from public.corretor_studio_profile_subscriptions ps join public.corretor_studio_profiles p on p.id=ps."profileId" where ps.id=corretor_studio_profile_subscription_capacities."profileSubscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "profile_subscription_capacities_update" on public.corretor_studio_profile_subscription_capacities for update to authenticated using (exists (select 1 from public.corretor_studio_profile_subscriptions ps join public.corretor_studio_profiles p on p.id=ps."profileId" where ps.id=corretor_studio_profile_subscription_capacities."profileSubscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "profile_subscription_capacities_delete" on public.corretor_studio_profile_subscription_capacities for delete to authenticated using (exists (select 1 from public.corretor_studio_profile_subscriptions ps join public.corretor_studio_profiles p on p.id=ps."profileId" where ps.id=corretor_studio_profile_subscription_capacities."profileSubscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

-- ─── health_plan_options (global read) ────────────────────────────────────────
create policy "health_plan_options_select" on public.corretor_studio_health_plan_options for select to authenticated using (true);

-- ─── email module ─────────────────────────────────────────────────────────────
create policy "email_campaigns_select" on public.corretor_studio_email_campaigns for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_campaigns."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_campaigns_insert" on public.corretor_studio_email_campaigns for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_campaigns."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_campaigns_update" on public.corretor_studio_email_campaigns for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_campaigns."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_campaigns_delete" on public.corretor_studio_email_campaigns for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_campaigns."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_contact_lists_select" on public.corretor_studio_email_contact_lists for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_contact_lists."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_contact_lists_insert" on public.corretor_studio_email_contact_lists for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_contact_lists."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_contact_lists_update" on public.corretor_studio_email_contact_lists for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_contact_lists."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_contact_lists_delete" on public.corretor_studio_email_contact_lists for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_contact_lists."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_contacts_select" on public.corretor_studio_email_contacts for select to authenticated using (exists (select 1 from public.corretor_studio_email_contact_lists cl join public.corretor_studio_team_members tm on tm."teamId"=cl."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where cl.id=corretor_studio_email_contacts."listId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_contacts_insert" on public.corretor_studio_email_contacts for insert to authenticated with check (exists (select 1 from public.corretor_studio_email_contact_lists cl join public.corretor_studio_team_members tm on tm."teamId"=cl."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where cl.id=corretor_studio_email_contacts."listId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_contacts_update" on public.corretor_studio_email_contacts for update to authenticated using (exists (select 1 from public.corretor_studio_email_contact_lists cl join public.corretor_studio_team_members tm on tm."teamId"=cl."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where cl.id=corretor_studio_email_contacts."listId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_contacts_delete" on public.corretor_studio_email_contacts for delete to authenticated using (exists (select 1 from public.corretor_studio_email_contact_lists cl join public.corretor_studio_team_members tm on tm."teamId"=cl."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where cl.id=corretor_studio_email_contacts."listId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_templates_select" on public.corretor_studio_email_templates for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_templates."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_templates_insert" on public.corretor_studio_email_templates for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_templates."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_templates_update" on public.corretor_studio_email_templates for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_templates."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_templates_delete" on public.corretor_studio_email_templates for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_templates."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_logs_select" on public.corretor_studio_email_logs for select to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_logs."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_logs_insert" on public.corretor_studio_email_logs for insert to authenticated with check (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_logs."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_logs_update" on public.corretor_studio_email_logs for update to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_logs."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_logs_delete" on public.corretor_studio_email_logs for delete to authenticated using (exists (select 1 from public.corretor_studio_team_members tm join public.corretor_studio_profiles p on p.id=tm."profileId" where tm."teamId"=corretor_studio_email_logs."teamId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_events_select" on public.corretor_studio_email_events for select to authenticated using (exists (select 1 from public.corretor_studio_email_logs el join public.corretor_studio_team_members tm on tm."teamId"=el."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where el.id=corretor_studio_email_events."logId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_events_insert" on public.corretor_studio_email_events for insert to authenticated with check (exists (select 1 from public.corretor_studio_email_logs el join public.corretor_studio_team_members tm on tm."teamId"=el."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where el.id=corretor_studio_email_events."logId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_events_update" on public.corretor_studio_email_events for update to authenticated using (exists (select 1 from public.corretor_studio_email_logs el join public.corretor_studio_team_members tm on tm."teamId"=el."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where el.id=corretor_studio_email_events."logId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_events_delete" on public.corretor_studio_email_events for delete to authenticated using (exists (select 1 from public.corretor_studio_email_logs el join public.corretor_studio_team_members tm on tm."teamId"=el."teamId" join public.corretor_studio_profiles p on p.id=tm."profileId" where el.id=corretor_studio_email_events."logId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_credit_subscriptions_select" on public.corretor_studio_email_credit_subscriptions for select to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_email_credit_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_credit_subscriptions_insert" on public.corretor_studio_email_credit_subscriptions for insert to authenticated with check (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_email_credit_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_credit_subscriptions_update" on public.corretor_studio_email_credit_subscriptions for update to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_email_credit_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_credit_subscriptions_delete" on public.corretor_studio_email_credit_subscriptions for delete to authenticated using (exists (select 1 from public.corretor_studio_profiles p where p.id=corretor_studio_email_credit_subscriptions."profileId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));

create policy "email_credit_usages_select" on public.corretor_studio_email_credit_usages for select to authenticated using (exists (select 1 from public.corretor_studio_email_credit_subscriptions cs join public.corretor_studio_profiles p on p.id=cs."profileId" where cs.id=corretor_studio_email_credit_usages."subscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_credit_usages_insert" on public.corretor_studio_email_credit_usages for insert to authenticated with check (exists (select 1 from public.corretor_studio_email_credit_subscriptions cs join public.corretor_studio_profiles p on p.id=cs."profileId" where cs.id=corretor_studio_email_credit_usages."subscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_credit_usages_update" on public.corretor_studio_email_credit_usages for update to authenticated using (exists (select 1 from public.corretor_studio_email_credit_subscriptions cs join public.corretor_studio_profiles p on p.id=cs."profileId" where cs.id=corretor_studio_email_credit_usages."subscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
create policy "email_credit_usages_delete" on public.corretor_studio_email_credit_usages for delete to authenticated using (exists (select 1 from public.corretor_studio_email_credit_subscriptions cs join public.corretor_studio_profiles p on p.id=cs."profileId" where cs.id=corretor_studio_email_credit_usages."subscriptionId" and (p."supabaseId"=auth.uid() or p.id=auth.uid())));
