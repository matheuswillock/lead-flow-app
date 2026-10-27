-- Webhook de entrada v2 (SPEC 11) e API Studio (SPEC 14): base de dados.
--   * corretor_studio_team_webhooks: escopos, SDRs padrão em rodízio, ponteiro do rodízio e link de Meet padrão.
--   * corretor_studio_team_webhook_inbound_events: evento recebido (idempotência + fila de processamento/retry).
--   * corretor_studio_lead_reschedule_alerts + corretor_studio_leads.needsReschedule: alerta "remarcar urgente".
--   * corretor_studio_team_api_resource_activations: ativação e token por recurso da API Studio.
-- Tabelas novas: RLS ligado, sem acesso para anon/authenticated, só service_role (mesmo padrão de
-- backoffice_adhesion_payments). O app acessa via Prisma/service role.
-- Rollback (sem dados de outras tabelas): DROP das 3 tabelas e dos 2 tipos; DROP das 5 colunas novas.

CREATE TYPE "public"."team_webhook_inbound_event_status" AS ENUM ('pending', 'processing', 'processed', 'failed');
CREATE TYPE "public"."team_api_resource_status" AS ENUM ('active', 'inactive');

ALTER TABLE "public"."corretor_studio_team_webhooks"
  ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY['leads_create']::TEXT[],
  ADD COLUMN "defaultAssigneeProfileIds" UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "lastAssignedProfileId" UUID,
  ADD COLUMN "defaultMeetingLink" TEXT;

ALTER TABLE "public"."corretor_studio_leads"
  ADD COLUMN "needsReschedule" BOOLEAN NOT NULL DEFAULT false;

-- Filtro "Precisa remarcar" do pipeline: só as poucas linhas sinalizadas entram no índice.
CREATE INDEX "corretor_studio_leads_teamId_needsReschedule_idx"
  ON "public"."corretor_studio_leads" ("teamId")
  WHERE "needsReschedule" = true;

CREATE TABLE "public"."corretor_studio_team_webhook_inbound_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "webhookId" UUID NOT NULL,
  "teamId" UUID NOT NULL,
  "contractVersion" INTEGER NOT NULL,
  "idempotencyKey" VARCHAR(255),
  "requestHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "public"."team_webhook_inbound_event_status" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMPTZ(6),
  "resultCode" TEXT,
  "leadId" UUID,
  "result" JSONB,
  "idempotencyKeyReused" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(6),
  CONSTRAINT "corretor_studio_team_webhook_inbound_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_team_webhook_inbound_events_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_team_webhook_inbound_events_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "public"."corretor_studio_team_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Idempotência: a mesma chave no mesmo webhook devolve o mesmo evento. Chave nula não conflita (cada
-- requisição sem chave é um evento novo): NULLs são distintos em unique do Postgres.
CREATE UNIQUE INDEX "corretor_studio_team_webhook_inbound_events_webhookId_idemp_key"
  ON "public"."corretor_studio_team_webhook_inbound_events" ("webhookId", "idempotencyKey");
CREATE INDEX "corretor_studio_team_webhook_inbound_events_status_nextAtte_idx"
  ON "public"."corretor_studio_team_webhook_inbound_events" ("status", "nextAttemptAt");
CREATE INDEX "corretor_studio_team_webhook_inbound_events_webhookId_recei_idx"
  ON "public"."corretor_studio_team_webhook_inbound_events" ("webhookId", "receivedAt" DESC);
CREATE INDEX "corretor_studio_team_webhook_inbound_events_teamId_received_idx"
  ON "public"."corretor_studio_team_webhook_inbound_events" ("teamId", "receivedAt" DESC);

CREATE TABLE "public"."corretor_studio_lead_reschedule_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "requestedStartsAt" TIMESTAMPTZ(6),
  "requestedCloserId" UUID,
  "conflictingLeadId" UUID,
  "suggestedSlots" JSONB NOT NULL DEFAULT '[]',
  "sourceEventId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(6),
  CONSTRAINT "corretor_studio_lead_reschedule_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_lead_reschedule_alerts_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "corretor_studio_lead_reschedule_alerts_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "public"."corretor_studio_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "corretor_studio_lead_reschedule_alerts_leadId_resolvedAt_idx"
  ON "public"."corretor_studio_lead_reschedule_alerts" ("leadId", "resolvedAt");
CREATE INDEX "corretor_studio_lead_reschedule_alerts_teamId_resolvedAt_cr_idx"
  ON "public"."corretor_studio_lead_reschedule_alerts" ("teamId", "resolvedAt", "createdAt" DESC);

CREATE TABLE "public"."corretor_studio_team_api_resource_activations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "resourceSlug" TEXT NOT NULL,
  "status" "public"."team_api_resource_status" NOT NULL DEFAULT 'active',
  "tokenHash" TEXT NOT NULL,
  "tokenPreview" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "expiresAt" TIMESTAMPTZ(6),
  "lastUsedAt" TIMESTAMPTZ(6),
  "activatedByProfileId" UUID NOT NULL,
  "updatedByProfileId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corretor_studio_team_api_resource_activations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_team_api_resource_activations_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "corretor_studio_team_api_resource_activations_tokenHash_key"
  ON "public"."corretor_studio_team_api_resource_activations" ("tokenHash");
CREATE UNIQUE INDEX "corretor_studio_team_api_resource_activations_teamId_resour_key"
  ON "public"."corretor_studio_team_api_resource_activations" ("teamId", "resourceSlug");

-- RLS: só service_role, nas três tabelas novas.
ALTER TABLE "public"."corretor_studio_team_webhook_inbound_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."corretor_studio_team_webhook_inbound_events" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."corretor_studio_team_webhook_inbound_events" TO service_role;
DROP POLICY IF EXISTS "corretor_studio_team_webhook_inbound_events_service_role_only"
  ON "public"."corretor_studio_team_webhook_inbound_events";
CREATE POLICY "corretor_studio_team_webhook_inbound_events_service_role_only"
  ON "public"."corretor_studio_team_webhook_inbound_events"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "public"."corretor_studio_lead_reschedule_alerts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."corretor_studio_lead_reschedule_alerts" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."corretor_studio_lead_reschedule_alerts" TO service_role;
DROP POLICY IF EXISTS "corretor_studio_lead_reschedule_alerts_service_role_only"
  ON "public"."corretor_studio_lead_reschedule_alerts";
CREATE POLICY "corretor_studio_lead_reschedule_alerts_service_role_only"
  ON "public"."corretor_studio_lead_reschedule_alerts"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE "public"."corretor_studio_team_api_resource_activations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."corretor_studio_team_api_resource_activations" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."corretor_studio_team_api_resource_activations" TO service_role;
DROP POLICY IF EXISTS "corretor_studio_team_api_resource_activations_service_role_only"
  ON "public"."corretor_studio_team_api_resource_activations";
CREATE POLICY "corretor_studio_team_api_resource_activations_service_role_only"
  ON "public"."corretor_studio_team_api_resource_activations"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
