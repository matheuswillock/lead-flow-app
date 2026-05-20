-- Migration generated from database diff to prisma/schema.prisma

-- CreateTable
CREATE TABLE "email_team_settings" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT 'Corretor Studio',
    "fromEmail" TEXT NOT NULL DEFAULT 'no-reply@corretorstudio.com',
    "replyTo" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_team_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_team_settings_teamId_key" ON "email_team_settings"("teamId");

-- AddForeignKey
ALTER TABLE "email_team_settings" ADD CONSTRAINT "email_team_settings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
