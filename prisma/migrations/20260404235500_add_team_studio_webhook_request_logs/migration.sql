-- CreateTable
CREATE TABLE "team_studio_webhook_request_logs" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "resultType" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_studio_webhook_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_studio_webhook_request_logs_teamId_createdAt_idx" ON "team_studio_webhook_request_logs"("teamId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "team_studio_webhook_request_logs_createdAt_idx" ON "team_studio_webhook_request_logs"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "team_studio_webhook_request_logs"
ADD CONSTRAINT "team_studio_webhook_request_logs_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
