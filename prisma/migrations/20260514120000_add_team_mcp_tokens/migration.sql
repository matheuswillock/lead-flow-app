-- Migration generated from database diff to prisma/schema.prisma

-- CreateTable
CREATE TABLE "team_mcp_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "teamId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_mcp_tokens_tokenHash_key" ON "team_mcp_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "team_mcp_tokens_teamId_idx" ON "team_mcp_tokens"("teamId");

-- CreateIndex
CREATE INDEX "team_mcp_tokens_tokenHash_idx" ON "team_mcp_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "team_mcp_tokens_createdBy_idx" ON "team_mcp_tokens"("createdBy");

-- AddForeignKey
ALTER TABLE "team_mcp_tokens" ADD CONSTRAINT "team_mcp_tokens_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_mcp_tokens" ADD CONSTRAINT "team_mcp_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
