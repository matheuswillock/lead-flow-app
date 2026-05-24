alter table "public"."corretor_studio_email_campaigns" enable row level security;

alter table "public"."corretor_studio_email_contact_lists" enable row level security;

alter table "public"."corretor_studio_email_contacts" enable row level security;

alter table "public"."corretor_studio_email_credit_subscriptions" enable row level security;

alter table "public"."corretor_studio_email_credit_usages" enable row level security;

alter table "public"."corretor_studio_email_events" enable row level security;

alter table "public"."corretor_studio_email_logs" enable row level security;

alter table "public"."corretor_studio_email_templates" enable row level security;

alter table "public"."corretor_studio_health_plan_options" enable row level security;

alter table "public"."corretor_studio_lead_activities" enable row level security;

alter table "public"."corretor_studio_lead_activity_reactions" enable row level security;

alter table "public"."corretor_studio_lead_attachments" enable row level security;

alter table "public"."corretor_studio_lead_finalized" enable row level security;

alter table "public"."corretor_studio_lead_finalized_dependents" enable row level security;

alter table "public"."corretor_studio_lead_finalized_holders" enable row level security;

alter table "public"."corretor_studio_lead_portfolio" enable row level security;

alter table "public"."corretor_studio_leads" enable row level security;

alter table "public"."corretor_studio_leads_schedule" enable row level security;

alter table "public"."corretor_studio_notifications" enable row level security;

alter table "public"."corretor_studio_pending_actions" enable row level security;

alter table "public"."corretor_studio_pending_operators" enable row level security;

alter table "public"."corretor_studio_profile_subscription_capacities" enable row level security;

alter table "public"."corretor_studio_profile_subscriptions" enable row level security;

alter table "public"."corretor_studio_profiles" enable row level security;

alter table "public"."corretor_studio_task_assignees" enable row level security;

alter table "public"."corretor_studio_tasks" enable row level security;

alter table "public"."corretor_studio_team_filter_presets" enable row level security;

alter table "public"."corretor_studio_team_members" enable row level security;

alter table "public"."corretor_studio_team_status_rules" enable row level security;

alter table "public"."corretor_studio_team_studio_webhook_configs" enable row level security;

alter table "public"."corretor_studio_team_studio_webhook_request_logs" enable row level security;

alter table "public"."corretor_studio_teams" enable row level security;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.hook_restrict_signup(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
declare
  usr_email   text;
  found_count int;
begin
  usr_email := event->'user'->>'email';
  select count(*) into found_count
  from public.corretor_studio_profiles
  where lower(email) = lower(usr_email);
  if found_count > 0 then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Conta nao encontrada. Crie conta com email e senha ou fale com o suporte.'
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_latest_schedule_no_show_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."status"::text = 'no_show'
     AND OLD."status"::text IS DISTINCT FROM 'no_show' THEN
    UPDATE corretor_studio_leads_schedule ls
    SET "noShowCount" = COALESCE(ls."noShowCount", 0) + 1,
        "updatedAt" = NOW()
    WHERE ls.id = (
      SELECT s.id
      FROM corretor_studio_leads_schedule s
      WHERE s."leadId" = NEW.id
      ORDER BY s.date DESC, s."createdAt" DESC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$function$
;


  create policy "lead_activities_realtime_select"
  on "public"."corretor_studio_lead_activities"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.corretor_studio_leads l
     JOIN public.corretor_studio_team_members tm ON ((tm."teamId" = l."teamId")))
     JOIN public.corretor_studio_profiles p ON ((p.id = tm."profileId")))
  WHERE ((l.id = corretor_studio_lead_activities."leadId") AND ((p."supabaseId" = auth.uid()) OR (p.id = auth.uid())) AND ((tm.role = 'manager'::public."UserRole") OR (tm.role = 'backoffice'::public."UserRole") OR ('SDR'::public."UserFunction" = ANY (tm.functions)) OR ('CLOSER'::public."UserFunction" = ANY (tm.functions)))))));



  create policy "lead_activity_reactions_realtime_select"
  on "public"."corretor_studio_lead_activity_reactions"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (((public.corretor_studio_lead_activities la
     JOIN public.corretor_studio_leads l ON ((l.id = la."leadId")))
     JOIN public.corretor_studio_team_members tm ON ((tm."teamId" = l."teamId")))
     JOIN public.corretor_studio_profiles p ON ((p.id = tm."profileId")))
  WHERE ((la.id = corretor_studio_lead_activity_reactions."activityId") AND ((p."supabaseId" = auth.uid()) OR (p.id = auth.uid())) AND ((tm.role = 'manager'::public."UserRole") OR (tm.role = 'backoffice'::public."UserRole") OR ('SDR'::public."UserFunction" = ANY (tm.functions)) OR ('CLOSER'::public."UserFunction" = ANY (tm.functions)))))));



  create policy "profiles_realtime_select"
  on "public"."corretor_studio_profiles"
  as permissive
  for select
  to authenticated
using ((("supabaseId" = auth.uid()) OR (id = auth.uid())));


CREATE TRIGGER trg_increment_latest_schedule_no_show_count AFTER UPDATE ON public.corretor_studio_leads FOR EACH ROW EXECUTE FUNCTION public.increment_latest_schedule_no_show_count();

alter publication supabase_realtime add table public.corretor_studio_lead_activities;
alter publication supabase_realtime add table public.corretor_studio_lead_activity_reactions;
alter publication supabase_realtime add table public.corretor_studio_profiles;

