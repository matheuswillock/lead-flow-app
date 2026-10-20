-- Persist the latest Studio DNS audit without changing the authoritative
-- TeamStudioDomain verification state on inconclusive checks.

-- Avoid waiting indefinitely for an ACCESS EXCLUSIVE lock during deployment.
set local lock_timeout = '5s';

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'team_studio_dns_audit_status' and n.nspname = 'public'
  ) then
    create type "public"."team_studio_dns_audit_status" as enum ('verified', 'pending', 'failed', 'inconclusive');
  elsif exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'team_studio_dns_audit_status' and n.nspname = 'public' and e.enumlabel = 'misconfigured'
  ) then
    create type "public"."team_studio_dns_audit_status_v2" as enum ('verified', 'pending', 'failed', 'inconclusive');
    alter table "public"."corretor_studio_team_studio_domains"
      alter column "dnsAuditStatus" type "public"."team_studio_dns_audit_status_v2"
      using case when "dnsAuditStatus"::text = 'misconfigured' then 'pending' else "dnsAuditStatus"::text end::"public"."team_studio_dns_audit_status_v2";
    drop type "public"."team_studio_dns_audit_status";
    alter type "public"."team_studio_dns_audit_status_v2" rename to "team_studio_dns_audit_status";
  end if;
end $$;

alter table "public"."corretor_studio_team_studio_domains"
  add column if not exists "dnsAuditStatus" "public"."team_studio_dns_audit_status",
  add column if not exists "dnsMisconfigured" boolean,
  add column if not exists "dnsReasonCode" text,
  add column if not exists "dnsReason" text,
  add column if not exists "recommendedCNAME" text,
  add column if not exists "lastDnsAuditAt" timestamp(6) with time zone,
  add column if not exists "lastDnsAttemptAt" timestamp(6) with time zone,
  add column if not exists "lastDnsFingerprint" text,
  add column if not exists "lastDnsNotifiedFingerprint" text;
