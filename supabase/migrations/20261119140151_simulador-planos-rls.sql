-- Simulador de planos: RLS fechada para anon/authenticated.
-- O app acessa estas tabelas somente pelo Prisma (role de servico do banco), que nao depende de RLS.
-- Sem policies: a API publica do Supabase (PostgREST) nao le nem escreve nessas tabelas.

ALTER TABLE "public"."corretor_studio_health_plan_operators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_health_plan_tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_health_plan_rule_texts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_health_plan_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_health_plan_network_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_health_plan_catalog_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_plan_quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."corretor_studio_plan_quote_shares" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "public"."corretor_studio_health_plan_operators",
  "public"."corretor_studio_health_plan_tables",
  "public"."corretor_studio_health_plan_rule_texts",
  "public"."corretor_studio_health_plan_providers",
  "public"."corretor_studio_health_plan_network_entries",
  "public"."corretor_studio_health_plan_catalog_imports",
  "public"."corretor_studio_plan_quotes",
  "public"."corretor_studio_plan_quote_shares"
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  "public"."corretor_studio_health_plan_operators",
  "public"."corretor_studio_health_plan_tables",
  "public"."corretor_studio_health_plan_rule_texts",
  "public"."corretor_studio_health_plan_providers",
  "public"."corretor_studio_health_plan_network_entries",
  "public"."corretor_studio_health_plan_catalog_imports",
  "public"."corretor_studio_plan_quotes",
  "public"."corretor_studio_plan_quote_shares"
TO service_role;
