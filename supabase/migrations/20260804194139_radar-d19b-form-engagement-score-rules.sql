-- D19-B-bis: regras backoffice que mapeiam score% do formulário → multiplicador de engajamento

CREATE TABLE IF NOT EXISTS "public"."backoffice_form_engagement_score_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "minPercent" INTEGER NOT NULL,
  "maxPercent" INTEGER NOT NULL,
  "multiplier" DOUBLE PRECISION NOT NULL,
  "label" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_form_engagement_score_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backoffice_form_engagement_score_rules_range_check"
    CHECK ("minPercent" >= 0 AND "maxPercent" <= 100 AND "minPercent" <= "maxPercent")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_form_engagement_score_rules_minPercent_maxPercent_key"
  ON "public"."backoffice_form_engagement_score_rules"("minPercent", "maxPercent");

CREATE INDEX IF NOT EXISTS "backoffice_form_engagement_score_rules_isActive_idx"
  ON "public"."backoffice_form_engagement_score_rules"("isActive");

INSERT INTO "public"."backoffice_form_engagement_score_rules"
  ("id", "minPercent", "maxPercent", "multiplier", "label", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 80, 100, 2.5, 'Lead qualificado — alta intenção', true, now(), now()),
  (gen_random_uuid(), 60, 79, 1.8, 'Lead acima da média', true, now(), now()),
  (gen_random_uuid(), 40, 59, 1.0, 'Lead médio (peso base sem alteração)', true, now(), now()),
  (gen_random_uuid(), 20, 39, 0.5, 'Lead abaixo da média', true, now(), now()),
  (gen_random_uuid(), 0, 19, 0.2, 'Lead de baixa qualidade', true, now(), now())
ON CONFLICT ("minPercent", "maxPercent") DO NOTHING;
