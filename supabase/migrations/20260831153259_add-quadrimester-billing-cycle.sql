alter type "public"."backoffice_adhesion_billing_cycle" rename to "backoffice_adhesion_billing_cycle__old_version_to_be_dropped";

create type "public"."backoffice_adhesion_billing_cycle" as enum ('monthly', 'quarterly', 'semiannual', 'annual', 'quadrimester');

alter table "public"."backoffice_adhesions" alter column cycle type "public"."backoffice_adhesion_billing_cycle" using cycle::text::"public"."backoffice_adhesion_billing_cycle";

alter table "public"."backoffice_product_payment_rules" alter column "billingCycle" type "public"."backoffice_adhesion_billing_cycle" using "billingCycle"::text::"public"."backoffice_adhesion_billing_cycle";

alter table "public"."backoffice_user_subscriptions" alter column cycle type "public"."backoffice_adhesion_billing_cycle" using cycle::text::"public"."backoffice_adhesion_billing_cycle";

drop type "public"."backoffice_adhesion_billing_cycle__old_version_to_be_dropped";

alter table "public"."backoffice_products" add column if not exists "priceQuadrimester" numeric(10,2);
