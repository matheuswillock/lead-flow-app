-- SPEC 14, A-E4 (T-14.16): log de uso por requisição dos recursos da API Studio.
-- O time vê, no Catálogo de API, as últimas consultas do parceiro: quando, qual dia, qual resposta.
-- Nunca guarda token, hash de token, IP nem dado de lead; só metadados da chamada.
-- Retenção de 30 dias, aplicada pelo cron já agendado `retry-inbound-webhook-events`.
-- Tabela nova: RLS ligado, sem acesso para anon/authenticated, só service_role (mesmo padrão das demais).
-- Rollback: DROP TABLE "public"."corretor_studio_team_api_request_logs".

CREATE TABLE "public"."corretor_studio_team_api_request_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "resourceSlug" TEXT NOT NULL,
  "activationId" UUID,
  "statusCode" INTEGER NOT NULL,
  "errorCode" TEXT,
  "requestedDate" VARCHAR(32),
  "durationMs" INTEGER,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corretor_studio_team_api_request_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corretor_studio_team_api_request_logs_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "public"."corretor_studio_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "corretor_studio_team_api_request_logs_team_slug_created_idx"
  ON "public"."corretor_studio_team_api_request_logs" ("teamId", "resourceSlug", "createdAt" DESC);
CREATE INDEX "corretor_studio_team_api_request_logs_createdAt_idx"
  ON "public"."corretor_studio_team_api_request_logs" ("createdAt");

ALTER TABLE "public"."corretor_studio_team_api_request_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."corretor_studio_team_api_request_logs" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."corretor_studio_team_api_request_logs" TO service_role;
DROP POLICY IF EXISTS "corretor_studio_team_api_request_logs_service_role_only"
  ON "public"."corretor_studio_team_api_request_logs";
CREATE POLICY "corretor_studio_team_api_request_logs_service_role_only"
  ON "public"."corretor_studio_team_api_request_logs"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
