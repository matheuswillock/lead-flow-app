-- D19: fundação — pesos/config backoffice + colunas de engajamento no RadarProfile

ALTER TABLE "public"."corretor_studio_radar_profiles"
  ADD COLUMN IF NOT EXISTS "engagementScore" SMALLINT,
  ADD COLUMN IF NOT EXISTS "engagementBand" TEXT;

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_profiles_teamId_engagementBand_idx"
  ON "public"."corretor_studio_radar_profiles"("teamId", "engagementBand");

CREATE INDEX IF NOT EXISTS "corretor_studio_radar_profiles_teamId_engagementScore_idx"
  ON "public"."corretor_studio_radar_profiles"("teamId", "engagementScore" DESC);

CREATE TABLE IF NOT EXISTS "public"."backoffice_radar_engagement_weights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "weight" INTEGER NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_radar_engagement_weights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "backoffice_radar_engagement_weights_eventType_key"
  ON "public"."backoffice_radar_engagement_weights"("eventType");

CREATE INDEX IF NOT EXISTS "backoffice_radar_engagement_weights_isActive_idx"
  ON "public"."backoffice_radar_engagement_weights"("isActive");

CREATE TABLE IF NOT EXISTS "public"."backoffice_radar_engagement_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "windowRecentDays" INTEGER NOT NULL DEFAULT 7,
  "windowMidDays" INTEGER NOT NULL DEFAULT 30,
  "windowOldDays" INTEGER NOT NULL DEFAULT 90,
  "recentMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "oldMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
  "hotThreshold" INTEGER NOT NULL DEFAULT 60,
  "warmThreshold" INTEGER NOT NULL DEFAULT 30,
  "lukewarmThreshold" INTEGER NOT NULL DEFAULT 10,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "backoffice_radar_engagement_configs_pkey" PRIMARY KEY ("id")
);

-- Seed: 15 pesos padrão (idempotente)
INSERT INTO "public"."backoffice_radar_engagement_weights"
  ("id", "eventType", "weight", "description", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'form.completed', 25, 'Maior sinal de intenção — preencheu formulário', true, now(), now()),
  (gen_random_uuid(), 'lead.milestone.contract_finalized', 22, 'Marco máximo de negócio fechado', true, now(), now()),
  (gen_random_uuid(), 'lead.milestone.future_sale', 18, 'Compromisso de compra futura', true, now(), now()),
  (gen_random_uuid(), 'whatsapp.message_received', 18, 'Respondeu — sinal ativo, não passivo', true, now(), now()),
  (gen_random_uuid(), 'portfolio.renewed', 15, 'Fidelidade renovada', true, now(), now()),
  (gen_random_uuid(), 'lead.milestone.new_opportunity', 12, 'Nova oportunidade aberta', true, now(), now()),
  (gen_random_uuid(), 'email.clicked', 12, 'Clique = intenção de ação', true, now(), now()),
  (gen_random_uuid(), 'form.started', 8, 'Começou mas não completou', true, now(), now()),
  (gen_random_uuid(), 'lead.milestone.invoice_payment', 8, 'Marco de cobrança', true, now(), now()),
  (gen_random_uuid(), 'portfolio.brokerage_transfer', 7, 'Troca de corretagem — vínculo ativo', true, now(), now()),
  (gen_random_uuid(), 'email.opened', 5, 'Curiosidade, sinal passivo', true, now(), now()),
  (gen_random_uuid(), 'pixel.pageview', 3, 'Visitou o site', true, now(), now()),
  (gen_random_uuid(), 'email.delivered', 1, 'Contato de sistema', true, now(), now()),
  (gen_random_uuid(), 'email.bounced', -30, 'Sinal negativo — penaliza score', true, now(), now()),
  (gen_random_uuid(), 'email.complained', -50, 'Sinal muito negativo — reclamação de spam', true, now(), now())
ON CONFLICT ("eventType") DO NOTHING;

-- Seed: config singleton (só se não houver linha ativa)
INSERT INTO "public"."backoffice_radar_engagement_configs"
  ("id", "windowRecentDays", "windowMidDays", "windowOldDays", "recentMultiplier", "oldMultiplier",
   "hotThreshold", "warmThreshold", "lukewarmThreshold", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 7, 30, 90, 2.0, 0.2, 60, 30, 10, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."backoffice_radar_engagement_configs" WHERE "isActive" = true
);
