-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "contractDueDate" TIMESTAMPTZ(6),
ADD COLUMN     "soldPlan" "HealthPlan",
ADD COLUMN     "ticket" DECIMAL(12,2);
