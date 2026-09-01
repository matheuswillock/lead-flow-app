create table "public"."billing_rate_limit_windows" (
    "key" text not null,
    "windowStart" timestamp(6) with time zone not null,
    "count" integer not null default 0,
    "createdAt" timestamp(6) with time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone not null
      );

CREATE UNIQUE INDEX billing_rate_limit_windows_pkey ON public.billing_rate_limit_windows USING btree (key, "windowStart");

alter table "public"."billing_rate_limit_windows" add constraint "billing_rate_limit_windows_pkey" PRIMARY KEY using index "billing_rate_limit_windows_pkey";
