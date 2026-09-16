-- Achado codex/cursor[bot] no PR #1167: RLS/GRANT MUST viver em migration
-- manual (db:migrate:new), nunca anexado à migration de schema gerada por
-- db:migrate:from-prisma — senão uma futura regeneração do diff a
-- reintroduz/remove silenciosamente. Extraído de
-- 20260910155726_backoffice-subscription-change-orders.sql e estendido para
-- a nova backoffice_subscription_change_order_events (G4/Fix C do mesmo PR).
-- Mesmo padrão de billing_rate_limit_windows (20260901232956, achado
-- cursor[bot]/codex no PR #1134): tabelas server-only (só Prisma/
-- service_role), RLS on, sem policy, grants explícitos.

ALTER TABLE "public"."backoffice_subscription_change_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."backoffice_subscription_change_orders" FROM anon;
REVOKE ALL ON TABLE "public"."backoffice_subscription_change_orders" FROM authenticated;
GRANT ALL ON TABLE "public"."backoffice_subscription_change_orders" TO service_role;

ALTER TABLE "public"."backoffice_subscription_change_order_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."backoffice_subscription_change_order_events" FROM anon;
REVOKE ALL ON TABLE "public"."backoffice_subscription_change_order_events" FROM authenticated;
GRANT ALL ON TABLE "public"."backoffice_subscription_change_order_events" TO service_role;
