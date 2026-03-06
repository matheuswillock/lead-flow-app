-- CreateTable
CREATE TABLE "health_plan_options" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "health_plan_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "health_plan_options_normalizedName_key" ON "health_plan_options"("normalizedName");

-- CreateIndex
CREATE INDEX "health_plan_options_name_idx" ON "health_plan_options"("name");

-- CreateIndex
CREATE INDEX "health_plan_options_createdBy_idx" ON "health_plan_options"("createdBy");

-- AddForeignKey
ALTER TABLE "health_plan_options" ADD CONSTRAINT "health_plan_options_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate lead fields from enum to text
ALTER TABLE "leads"
    ALTER COLUMN "currentHealthPlan" TYPE TEXT USING "currentHealthPlan"::text,
    ALTER COLUMN "soldPlan" TYPE TEXT USING "soldPlan"::text;

-- Seed default health plans
INSERT INTO "health_plan_options" ("id", "name", "normalizedName", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), 'Nova Adesão', 'novaadesao', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Amil', 'amil', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Alice', 'alice', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Bradesco', 'bradesco', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Hapvida', 'hapvida', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'MedSênior', 'medsenior', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'NotreDame Intermédica (GNDI)', 'notredameintermedica(gndi)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Omint', 'omint', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Plena', 'plena', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Porto Seguro', 'portoseguro', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Prevent Senior', 'preventsenior', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'SulAmérica', 'sulamerica', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Unimed', 'unimed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Outros', 'outros', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO NOTHING;

-- Ensure every distinct value already stored in leads exists in the catalog
WITH distinct_plans AS (
    SELECT DISTINCT BTRIM("currentHealthPlan") AS plan_name
    FROM "leads"
    WHERE "currentHealthPlan" IS NOT NULL AND BTRIM("currentHealthPlan") <> ''
    UNION
    SELECT DISTINCT BTRIM("soldPlan") AS plan_name
    FROM "leads"
    WHERE "soldPlan" IS NOT NULL AND BTRIM("soldPlan") <> ''
)
INSERT INTO "health_plan_options" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    p.plan_name,
    LOWER(
        REGEXP_REPLACE(
            TRANSLATE(
                p.plan_name,
                'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
            ),
            '\s+',
            '',
            'g'
        )
    ) AS normalized_name,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM distinct_plans p
ON CONFLICT ("normalizedName") DO NOTHING;

-- Drop old enum after migration
DROP TYPE IF EXISTS "HealthPlan";
