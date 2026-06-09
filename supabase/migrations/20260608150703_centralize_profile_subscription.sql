begin;

alter table public.corretor_studio_profile_subscriptions
  add column if not exists "asaasCustomerId" text;

insert into public.corretor_studio_profile_subscriptions (
  "profileId",
  "asaasCustomerId",
  "asaasSubscriptionId",
  "subscriptionStatus",
  "subscriptionPlan",
  "subscriptionStartDate",
  "subscriptionEndDate",
  "trialEndDate",
  "subscriptionNextDueDate",
  "subscriptionCycle",
  "subscriptionLastSyncedAt",
  "hasPermanentSubscription",
  "createdAt",
  "updatedAt"
)
select
  p.id,
  p."asaasCustomerId",
  coalesce(p."asaasSubscriptionId", p."subscriptionId"),
  p."subscriptionStatus",
  p."subscriptionPlan",
  p."subscriptionStartDate",
  p."subscriptionEndDate",
  p."trialEndDate",
  p."subscriptionNextDueDate",
  p."subscriptionCycle",
  p."updatedAt",
  coalesce(p."hasPermanentSubscription", false),
  coalesce(p."createdAt", now()),
  now()
from public.corretor_studio_profiles p
where p."subscriptionId" is not null
   or p."asaasCustomerId" is not null
   or p."asaasSubscriptionId" is not null
   or p."subscriptionStatus" is not null
   or p."subscriptionPlan" is not null
   or p."subscriptionStartDate" is not null
   or p."subscriptionEndDate" is not null
   or p."trialEndDate" is not null
   or p."subscriptionNextDueDate" is not null
   or p."subscriptionCycle" is not null
   or p."hasPermanentSubscription" = true
on conflict ("profileId") do update
set
  "asaasCustomerId" = coalesce(excluded."asaasCustomerId", public.corretor_studio_profile_subscriptions."asaasCustomerId"),
  "asaasSubscriptionId" = coalesce(excluded."asaasSubscriptionId", public.corretor_studio_profile_subscriptions."asaasSubscriptionId"),
  "subscriptionStatus" = coalesce(excluded."subscriptionStatus", public.corretor_studio_profile_subscriptions."subscriptionStatus"),
  "subscriptionPlan" = coalesce(excluded."subscriptionPlan", public.corretor_studio_profile_subscriptions."subscriptionPlan"),
  "subscriptionStartDate" = coalesce(excluded."subscriptionStartDate", public.corretor_studio_profile_subscriptions."subscriptionStartDate"),
  "subscriptionEndDate" = coalesce(excluded."subscriptionEndDate", public.corretor_studio_profile_subscriptions."subscriptionEndDate"),
  "trialEndDate" = coalesce(excluded."trialEndDate", public.corretor_studio_profile_subscriptions."trialEndDate"),
  "subscriptionNextDueDate" = coalesce(excluded."subscriptionNextDueDate", public.corretor_studio_profile_subscriptions."subscriptionNextDueDate"),
  "subscriptionCycle" = coalesce(excluded."subscriptionCycle", public.corretor_studio_profile_subscriptions."subscriptionCycle"),
  "subscriptionLastSyncedAt" = coalesce(excluded."subscriptionLastSyncedAt", public.corretor_studio_profile_subscriptions."subscriptionLastSyncedAt"),
  "hasPermanentSubscription" = excluded."hasPermanentSubscription",
  "updatedAt" = now();

do $$
declare
  mismatch_count integer;
begin
  select count(*)
    into mismatch_count
  from public.corretor_studio_profiles p
  left join public.corretor_studio_profile_subscriptions ps
    on ps."profileId" = p.id
  where (
      p."subscriptionId" is not null
      or p."asaasCustomerId" is not null
      or p."asaasSubscriptionId" is not null
      or p."subscriptionStatus" is not null
      or p."subscriptionPlan" is not null
      or p."subscriptionStartDate" is not null
      or p."subscriptionEndDate" is not null
      or p."trialEndDate" is not null
      or p."subscriptionNextDueDate" is not null
      or p."subscriptionCycle" is not null
      or p."hasPermanentSubscription" = true
    )
    and (
      ps.id is null
      or p."asaasCustomerId" is distinct from ps."asaasCustomerId"
      or coalesce(p."asaasSubscriptionId", p."subscriptionId") is distinct from ps."asaasSubscriptionId"
      or p."subscriptionStatus" is distinct from ps."subscriptionStatus"
      or p."subscriptionPlan" is distinct from ps."subscriptionPlan"
      or p."subscriptionStartDate" is distinct from ps."subscriptionStartDate"
      or p."subscriptionEndDate" is distinct from ps."subscriptionEndDate"
      or p."trialEndDate" is distinct from ps."trialEndDate"
      or p."subscriptionNextDueDate" is distinct from ps."subscriptionNextDueDate"
      or p."subscriptionCycle" is distinct from ps."subscriptionCycle"
      or p."hasPermanentSubscription" is distinct from ps."hasPermanentSubscription"
    );

  if mismatch_count > 0 then
    raise exception 'Profile and ProfileSubscription mismatch after backfill: % rows diverged', mismatch_count;
  end if;
end $$;

update public.corretor_studio_profiles p
set
  "subscriptionId" = ps.id::text,
  "asaasCustomerId" = ps."asaasCustomerId",
  "asaasSubscriptionId" = ps."asaasSubscriptionId",
  "subscriptionStatus" = ps."subscriptionStatus",
  "subscriptionPlan" = ps."subscriptionPlan",
  "subscriptionStartDate" = ps."subscriptionStartDate",
  "subscriptionEndDate" = ps."subscriptionEndDate",
  "trialEndDate" = ps."trialEndDate",
  "subscriptionNextDueDate" = ps."subscriptionNextDueDate",
  "subscriptionCycle" = ps."subscriptionCycle",
  "hasPermanentSubscription" = ps."hasPermanentSubscription",
  "updatedAt" = now()
from public.corretor_studio_profile_subscriptions ps
where ps."profileId" = p.id;

alter table public.corretor_studio_profiles
  alter column "subscriptionId" type uuid using case
    when "subscriptionId" is null then null
    else "subscriptionId"::uuid
  end;

create unique index if not exists "corretor_studio_profiles_subscriptionId_key"
  on public.corretor_studio_profiles using btree ("subscriptionId");

do $$
begin
  alter table public.corretor_studio_profiles
    add constraint "corretor_studio_profiles_subscriptionId_fkey"
    foreign key ("subscriptionId")
    references public.corretor_studio_profile_subscriptions(id)
    on update cascade
    on delete set null
    not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.corretor_studio_profiles
  validate constraint "corretor_studio_profiles_subscriptionId_fkey";

alter table public.backoffice_user_subscriptions rename to backoffice_user_product_subscriptions;
alter index if exists "backoffice_user_subscriptions_pkey" rename to "backoffice_user_product_subscriptions_pkey";
alter index if exists "backoffice_user_subscriptions_profileId_status_idx" rename to "backoffice_user_product_subscriptions_profileId_status_idx";
alter index if exists "backoffice_user_subscriptions_productId_idx" rename to "backoffice_user_product_subscriptions_productId_idx";
alter index if exists "backoffice_user_subscriptions_adhesionId_idx" rename to "backoffice_user_product_subscriptions_adhesionId_idx";
alter index if exists "backoffice_user_subscriptions_profile_id_product_id_key" rename to "backoffice_user_product_subscriptions_profile_id_product_id_key";

commit;
