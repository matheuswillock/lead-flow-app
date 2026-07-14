-- Migration: enable-rls-audit-log
-- Habilita RLS na tabela corretor_studio_audit_logs sem nenhuma policy
-- (deny-by-default). Gravacao acontece apenas via Prisma com service role
-- (bypassa RLS), entao nao ha necessidade de policy de INSERT/UPDATE/DELETE
-- para o client. Policy de SELECT fica para quando a tela de visualizacao
-- do audit log for construida (fora de escopo desta migration).

ALTER TABLE "public"."corretor_studio_audit_logs" ENABLE ROW LEVEL SECURITY;
