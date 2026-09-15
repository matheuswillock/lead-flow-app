create table "public"."backoffice_subscription_change_order_events" (
    "id" uuid not null,
    "changeOrderId" uuid not null,
    "changeType" text not null,
    "eventType" public.subscription_lifecycle_event,
    "actorProfileId" uuid,
    "payload" jsonb,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP
      );

CREATE INDEX "backoffice_subscription_change_order_events_actorProfileId_idx" ON public.backoffice_subscription_change_order_events USING btree ("actorProfileId");

CREATE INDEX "backoffice_subscription_change_order_events_changeOrderId_c_idx" ON public.backoffice_subscription_change_order_events USING btree ("changeOrderId", "createdAt" DESC);

CREATE UNIQUE INDEX backoffice_subscription_change_order_events_pkey ON public.backoffice_subscription_change_order_events USING btree (id);

alter table "public"."backoffice_subscription_change_order_events" add constraint "backoffice_subscription_change_order_events_pkey" PRIMARY KEY using index "backoffice_subscription_change_order_events_pkey";

alter table "public"."backoffice_subscription_change_order_events" add constraint "backoffice_subscription_change_order_events_actorProfileId_fkey" FOREIGN KEY ("actorProfileId") REFERENCES public.corretor_studio_profiles(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."backoffice_subscription_change_order_events" validate constraint "backoffice_subscription_change_order_events_actorProfileId_fkey";

alter table "public"."backoffice_subscription_change_order_events" add constraint "backoffice_subscription_change_order_events_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES public.backoffice_subscription_change_orders(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."backoffice_subscription_change_order_events" validate constraint "backoffice_subscription_change_order_events_changeOrderId_fkey";
