-- Precedência de nome no Radar: `nameSource` em RadarProfile.
--
-- Escrita à mão (db:migrate:new) em vez de db:migrate:from-prisma: o gerador
-- está produzindo ~900 linhas de DROP de trigger/function/índice por causa do
-- drift do Postgres local documentado em
-- docs/audits/prisma-migrations-drift-2026-08-23.md. A mudança real é uma
-- coluna. Mesmo padrão de DDL de 20260811010451_radar-profile-gender-field.sql.
--
-- Contrapartida no schema: prisma/schema.prisma → model RadarProfile →
-- `nameSource String? @db.Text`. Nome físico da tabela vem do
-- @@map("corretor_studio_radar_profiles"); as colunas não têm @map, então são
-- camelCase entre aspas.

ALTER TABLE "public"."corretor_studio_radar_profiles"
  ADD COLUMN IF NOT EXISTS "nameSource" TEXT;

-- Backfill: sem isto a política nasce sem dente para a base existente.
-- `nameSource` nulo tem rank 0 em lib/radar/name-source.ts, ou seja, qualquer
-- origem — inclusive o push name do WhatsApp — poderia reescrever o nome uma
-- vez. Perfis com identidade `lead_id` são exatamente os que receberam nome
-- curado do CRM (RadarService.syncFromCrm passa `lead.name`), então carimbamos
-- 'crm' neles. O resto continua nulo de propósito: não sabemos a procedência e
-- não vamos inventar uma.
UPDATE "public"."corretor_studio_radar_profiles" AS p
SET "nameSource" = 'crm'
WHERE p."nameSource" IS NULL
  AND btrim(p."displayName") <> ''
  AND EXISTS (
    SELECT 1
    FROM "public"."corretor_studio_radar_identities" AS i
    WHERE i."profileId" = p."id"
      AND i."type" = 'lead_id'::"public"."radar_identity_type"
  );
