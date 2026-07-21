-- ============================================================================
-- RADAR — Estágio R1: rename físico do módulo CDP → Radar
-- Referências: RADAR_SPEC.md (D1–D3), RADAR_AUDIT.md §5.1–5.2
--
-- Escopo (somente banco físico; código segue intacto via @@map no Prisma):
--   1. 5 tabelas  corretor_studio_cdp_*  → corretor_studio_radar_*
--   2. 5 tipos    customer_*             → radar_*
--      (NÃO toca email_variable_value_source — valor 'CDP'→'RADAR' é o R3)
--   3. Todos os índices e constraints com "cdp" no nome → "radar"
--      (rename dinâmico: cobre tanto o conjunto era-Prisma quanto o
--       era-Supabase presente no remoto; nenhum índice é dropado — a
--       deduplicação dos conjuntos redundantes é o estágio C6)
--   4. 20 policies cdp_* → radar_*
--
-- Idempotência: cada bloco é guardado por to_regclass/pg_type/pg_catalog;
-- replay em banco já renomeado é no-op.
--
-- PLANO B (documentado, NÃO implementado — ver D3): se o dono exigir janela
-- zero entre migration remota e deploy, criar views de compatibilidade
-- temporárias com os nomes antigos apontando para as tabelas novas, ex.:
--   CREATE VIEW corretor_studio_cdp_profiles AS
--     SELECT * FROM corretor_studio_radar_profiles;
--   (idem para _identities, _source_links, _events, _channel_consents,
--    com GRANTs equivalentes; dropar as views após o deploy promover.)
-- Views não cobrem INSERT/UPDATE com RETURNING via PostgREST em todos os
-- casos — por isso o caminho padrão é a janela coordenada, não o plano B.
-- ============================================================================

-- 1. Tabelas -----------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','identities','source_links','events','channel_consents']
  LOOP
    IF to_regclass(format('public.corretor_studio_cdp_%s', t)) IS NOT NULL
       AND to_regclass(format('public.corretor_studio_radar_%s', t)) IS NULL THEN
      EXECUTE format(
        'ALTER TABLE "public"."corretor_studio_cdp_%s" RENAME TO "corretor_studio_radar_%s"',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- 2. Tipos enum --------------------------------------------------------------

DO $$
DECLARE
  e text;
BEGIN
  FOREACH e IN ARRAY ARRAY['identity_type','source_type','channel','consent_status','consent_reason']
  LOOP
    IF EXISTS (
         SELECT 1 FROM pg_type typ
         JOIN pg_namespace ns ON ns.oid = typ.typnamespace
         WHERE ns.nspname = 'public' AND typ.typname = 'customer_' || e
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_type typ
         JOIN pg_namespace ns ON ns.oid = typ.typnamespace
         WHERE ns.nspname = 'public' AND typ.typname = 'radar_' || e
       ) THEN
      EXECUTE format('ALTER TYPE "public"."customer_%s" RENAME TO "radar_%s"', e, e);
    END IF;
  END LOOP;
END $$;

-- 3. Constraints e índices ---------------------------------------------------
-- Rename dinâmico: todo nome contendo "cdp" em objetos do schema public vira
-- "radar". Constraints primeiro (renomear a constraint renomeia o índice
-- subjacente); depois os índices restantes (não ligados a constraint).
-- Cobre os DOIS conjuntos de índices (era Prisma e era Supabase — audit §5.2),
-- incluindo corretor_studio_cdp_profiles_team_profile_data_idx. Nenhum DROP.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname AS old_name,
           con.conrelid::regclass::text AS table_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    WHERE ns.nspname = 'public' AND con.conname LIKE '%cdp%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
      r.table_name, r.old_name, replace(r.old_name, 'cdp', 'radar')
    );
  END LOOP;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT indexname AS old_name
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname LIKE '%cdp%'
  LOOP
    EXECUTE format(
      'ALTER INDEX "public".%I RENAME TO %I',
      r.old_name, replace(r.old_name, 'cdp', 'radar')
    );
  END LOOP;
END $$;

-- 4. Policies ----------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT pol.policyname AS old_name, pol.tablename
    FROM pg_policies pol
    WHERE pol.schemaname = 'public' AND pol.policyname LIKE 'cdp\_%'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON "public".%I RENAME TO %I',
      r.old_name, r.tablename, replace(r.old_name, 'cdp', 'radar')
    );
  END LOOP;
END $$;
