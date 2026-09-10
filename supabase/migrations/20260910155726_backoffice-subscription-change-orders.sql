create type "public"."backoffice_subscription_change_order_override_status" as enum ('not_required', 'pending', 'approved');

create type "public"."backoffice_subscription_change_order_status" as enum ('draft', 'awaiting_payment', 'applied', 'canceled');

  create table "public"."backoffice_subscription_change_orders" (
    "id" uuid not null default gen_random_uuid(),
    "masterProfileId" uuid not null,
    "status" public.backoffice_subscription_change_order_status not null default 'draft'::public.backoffice_subscription_change_order_status,
    "currentProductId" uuid,
    "currentCycle" public.backoffice_adhesion_billing_cycle,
    "currentChargedAmount" numeric(12,2),
    "currentPeriodEnd" timestamp(6) with time zone,
    "targetProductId" uuid not null,
    "targetCycle" public.backoffice_adhesion_billing_cycle not null,
    "listAmount" numeric(12,2) not null,
    "proratedAmount" numeric(12,2) not null,
    "overrideAmount" numeric(12,2),
    "overrideStatus" public.backoffice_subscription_change_order_override_status not null default 'not_required'::public.backoffice_subscription_change_order_override_status,
    "overrideApprovedByProfileId" uuid,
    "overrideApprovedAt" timestamp(6) with time zone,
    "chargeAmount" numeric(12,2) not null,
    "createdByBackofficeUserId" uuid,
    "canceledAt" timestamp(6) with time zone,
    "appliedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

CREATE INDEX backoffice_subscription_change_orders_master_profile_id_idx ON public.backoffice_subscription_change_orders USING btree ("masterProfileId");

CREATE UNIQUE INDEX backoffice_subscription_change_orders_pkey ON public.backoffice_subscription_change_orders USING btree (id);

CREATE INDEX backoffice_subscription_change_orders_status_idx ON public.backoffice_subscription_change_orders USING btree (status);

alter table "public"."backoffice_subscription_change_orders" add constraint "backoffice_subscription_change_orders_pkey" PRIMARY KEY using index "backoffice_subscription_change_orders_pkey";

alter table "public"."backoffice_subscription_change_orders" add constraint "backoffice_subscription_change_orders_createdByBackofficeU_fkey" FOREIGN KEY ("createdByBackofficeUserId") REFERENCES public.backoffice_users(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_subscription_change_orders" validate constraint "backoffice_subscription_change_orders_createdByBackofficeU_fkey";

alter table "public"."backoffice_subscription_change_orders" add constraint "backoffice_subscription_change_orders_currentProductId_fkey" FOREIGN KEY ("currentProductId") REFERENCES public.backoffice_products(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_subscription_change_orders" validate constraint "backoffice_subscription_change_orders_currentProductId_fkey";

alter table "public"."backoffice_subscription_change_orders" add constraint "backoffice_subscription_change_orders_masterProfileId_fkey" FOREIGN KEY ("masterProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_subscription_change_orders" validate constraint "backoffice_subscription_change_orders_masterProfileId_fkey";

alter table "public"."backoffice_subscription_change_orders" add constraint "backoffice_subscription_change_orders_overrideApprovedByPr_fkey" FOREIGN KEY ("overrideApprovedByProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_subscription_change_orders" validate constraint "backoffice_subscription_change_orders_overrideApprovedByPr_fkey";

alter table "public"."backoffice_subscription_change_orders" add constraint "backoffice_subscription_change_orders_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES public.backoffice_products(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_subscription_change_orders" validate constraint "backoffice_subscription_change_orders_targetProductId_fkey";

-- Tabela server-only (só Prisma/service_role) — mesmo padrão de
-- billing_rate_limit_windows (20260901232956, achado cursor[bot]/codex no
-- PR #1134): RLS on, sem policy, grants explícitos.
ALTER TABLE "public"."backoffice_subscription_change_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."backoffice_subscription_change_orders" FROM anon;
REVOKE ALL ON TABLE "public"."backoffice_subscription_change_orders" FROM authenticated;
GRANT ALL ON TABLE "public"."backoffice_subscription_change_orders" TO service_role;
