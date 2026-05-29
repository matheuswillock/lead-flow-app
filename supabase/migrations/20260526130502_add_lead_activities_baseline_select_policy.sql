-- Baseline SELECT policy for lead activities: any authenticated team member can read
-- activities for leads in their teams. This complements the existing
-- lead_activities_realtime_select policy (which restricts by role/functions) — since
-- RLS policies are PERMISSIVE by default, the union of both grants access.
create policy "lead_activities_select" on public.corretor_studio_lead_activities
  for select to authenticated
  using (
    exists (
      select 1
      from public.corretor_studio_leads l
      join public.corretor_studio_team_members tm on tm."teamId" = l."teamId"
      join public.corretor_studio_profiles p on p.id = tm."profileId"
      where l.id = corretor_studio_lead_activities."leadId"
        and (p."supabaseId" = auth.uid() or p.id = auth.uid())
    )
  );
