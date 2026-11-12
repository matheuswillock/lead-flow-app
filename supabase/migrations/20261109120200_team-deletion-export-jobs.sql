-- Exportação ao excluir um time: pedido (fila de geração do ZIP) e bucket privado do arquivo.
--   * corretor_studio_team_deletion_export_jobs: guarda quem pediu, a situação e o arquivo. NÃO tem chave
--     estrangeira para o time: o pedido precisa sobreviver à exclusão do time.
--   * bucket privado "team-exports": o download só acontece por URL assinada de curta duração, gerada
--     pela rota autenticada; o arquivo é apagado quando o prazo de 7 dias vence.
-- Tabela nova: RLS ligado, sem acesso para anon/authenticated, só service_role (mesmo padrão das demais).
-- Rollback: DROP da tabela e remoção do bucket.

CREATE TABLE "public"."corretor_studio_team_deletion_export_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL,
  "teamName" TEXT NOT NULL,
  "requesterProfileId" UUID NOT NULL,
  "requesterEmail" TEXT NOT NULL,
  "requesterName" TEXT NOT NULL,
  "billingOwnerId" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMPTZ(6),
  "filePath" TEXT,
  "fileSizeBytes" INTEGER,
  "expiresAt" TIMESTAMPTZ(6),
  "counts" JSONB,
  "lastError" TEXT,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "lastDownloadedAt" TIMESTAMPTZ(6),
  "lastDownloadedBy" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6),
  "purgedAt" TIMESTAMPTZ(6),
  CONSTRAINT "corretor_studio_team_deletion_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "corretor_studio_team_deletion_export_jobs_status_createdAt_idx"
  ON "public"."corretor_studio_team_deletion_export_jobs" ("status", "createdAt");
CREATE INDEX "corretor_studio_team_deletion_export_jobs_requesterProfileId_idx"
  ON "public"."corretor_studio_team_deletion_export_jobs" ("requesterProfileId");

ALTER TABLE "public"."corretor_studio_team_deletion_export_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."corretor_studio_team_deletion_export_jobs" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "public"."corretor_studio_team_deletion_export_jobs" TO service_role;
DROP POLICY IF EXISTS "corretor_studio_team_deletion_export_jobs_service_role_only"
  ON "public"."corretor_studio_team_deletion_export_jobs";
CREATE POLICY "corretor_studio_team_deletion_export_jobs_service_role_only"
  ON "public"."corretor_studio_team_deletion_export_jobs"
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-exports',
  'team-exports',
  false,
  104857600,
  ARRAY['application/zip']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
