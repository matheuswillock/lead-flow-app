-- CreateTable
CREATE TABLE "pending_operators" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "operatorCreated" BOOLEAN NOT NULL DEFAULT false,
    "operatorId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pending_operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_operators_paymentId_key" ON "pending_operators"("paymentId");

-- CreateIndex
CREATE INDEX "pending_operators_managerId_idx" ON "pending_operators"("managerId");

-- CreateIndex
CREATE INDEX "pending_operators_paymentId_idx" ON "pending_operators"("paymentId");

-- CreateIndex
CREATE INDEX "pending_operators_email_idx" ON "pending_operators"("email");

-- AddForeignKey
ALTER TABLE "pending_operators" ADD CONSTRAINT "pending_operators_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
