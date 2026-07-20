-- As APIs públicas e administrativas acessam estas tabelas somente pelo backend.
-- Nenhuma tabela do domínio é exposta diretamente ao cliente via PostgREST.
alter table public.corretor_studio_public_form_settings enable row level security;
alter table public.corretor_studio_public_forms enable row level security;
alter table public.corretor_studio_public_form_eligible_closers enable row level security;
alter table public.corretor_studio_public_form_questions enable row level security;
alter table public.corretor_studio_public_form_options enable row level security;
alter table public.corretor_studio_public_form_rules enable row level security;
alter table public.corretor_studio_public_form_score_bands enable row level security;
alter table public.corretor_studio_public_form_publications enable row level security;
alter table public.corretor_studio_public_form_submissions enable row level security;
alter table public.corretor_studio_public_form_answers enable row level security;
alter table public.corretor_studio_public_form_metric_events enable row level security;

revoke all on table public.corretor_studio_public_form_settings from anon, authenticated;
revoke all on table public.corretor_studio_public_forms from anon, authenticated;
revoke all on table public.corretor_studio_public_form_eligible_closers from anon, authenticated;
revoke all on table public.corretor_studio_public_form_questions from anon, authenticated;
revoke all on table public.corretor_studio_public_form_options from anon, authenticated;
revoke all on table public.corretor_studio_public_form_rules from anon, authenticated;
revoke all on table public.corretor_studio_public_form_score_bands from anon, authenticated;
revoke all on table public.corretor_studio_public_form_publications from anon, authenticated;
revoke all on table public.corretor_studio_public_form_submissions from anon, authenticated;
revoke all on table public.corretor_studio_public_form_answers from anon, authenticated;
revoke all on table public.corretor_studio_public_form_metric_events from anon, authenticated;

grant all on table public.corretor_studio_public_form_settings to service_role;
grant all on table public.corretor_studio_public_forms to service_role;
grant all on table public.corretor_studio_public_form_eligible_closers to service_role;
grant all on table public.corretor_studio_public_form_questions to service_role;
grant all on table public.corretor_studio_public_form_options to service_role;
grant all on table public.corretor_studio_public_form_rules to service_role;
grant all on table public.corretor_studio_public_form_score_bands to service_role;
grant all on table public.corretor_studio_public_form_publications to service_role;
grant all on table public.corretor_studio_public_form_submissions to service_role;
grant all on table public.corretor_studio_public_form_answers to service_role;
grant all on table public.corretor_studio_public_form_metric_events to service_role;

create policy public_form_settings_service_role_all
  on public.corretor_studio_public_form_settings for all to service_role
  using (true) with check (true);
create policy public_forms_service_role_all
  on public.corretor_studio_public_forms for all to service_role
  using (true) with check (true);
create policy public_form_eligible_closers_service_role_all
  on public.corretor_studio_public_form_eligible_closers for all to service_role
  using (true) with check (true);
create policy public_form_questions_service_role_all
  on public.corretor_studio_public_form_questions for all to service_role
  using (true) with check (true);
create policy public_form_options_service_role_all
  on public.corretor_studio_public_form_options for all to service_role
  using (true) with check (true);
create policy public_form_rules_service_role_all
  on public.corretor_studio_public_form_rules for all to service_role
  using (true) with check (true);
create policy public_form_score_bands_service_role_all
  on public.corretor_studio_public_form_score_bands for all to service_role
  using (true) with check (true);
create policy public_form_publications_service_role_all
  on public.corretor_studio_public_form_publications for all to service_role
  using (true) with check (true);
create policy public_form_submissions_service_role_all
  on public.corretor_studio_public_form_submissions for all to service_role
  using (true) with check (true);
create policy public_form_answers_service_role_all
  on public.corretor_studio_public_form_answers for all to service_role
  using (true) with check (true);
create policy public_form_metric_events_service_role_all
  on public.corretor_studio_public_form_metric_events for all to service_role
  using (true) with check (true);
