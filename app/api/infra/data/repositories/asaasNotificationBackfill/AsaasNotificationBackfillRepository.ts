import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasNotificationBackfillStatus } from "@prisma/client"
import type { IAsaasNotificationBackfillRepository } from "./IAsaasNotificationBackfillRepository"

export class AsaasNotificationBackfillRepository
  implements IAsaasNotificationBackfillRepository
{
  async markCompleted(asaasCustomerId: string): Promise<void> {
    await prisma.asaasNotificationBackfill.upsert({
      where: { asaasCustomerId },
      create: {
        asaasCustomerId,
        status: "completed",
        lastError: null,
        completedAt: new Date(),
      },
      update: {
        status: "completed",
        lastError: null,
        completedAt: new Date(),
      },
    })
  }

  async markFailed(asaasCustomerId: string, error: string): Promise<void> {
    await prisma.asaasNotificationBackfill.upsert({
      where: { asaasCustomerId },
      create: {
        asaasCustomerId,
        status: "failed",
        lastError: error,
        completedAt: null,
      },
      update: {
        status: "failed",
        lastError: error,
        completedAt: null,
      },
    })
  }

  async getStatus(asaasCustomerId: string): Promise<AsaasNotificationBackfillStatus | null> {
    const row = await prisma.asaasNotificationBackfill.findUnique({
      where: { asaasCustomerId },
      select: { status: true },
    })
    return row?.status ?? null
  }

  async listCompletedCustomerIds(): Promise<string[]> {
    const rows = await prisma.asaasNotificationBackfill.findMany({
      where: { status: "completed" },
      select: { asaasCustomerId: true },
    })
    return rows.map((row) => row.asaasCustomerId)
  }

  async listProfileAsaasCustomerIds(limit: number): Promise<string[]> {
    const rows = await prisma.profile.findMany({
      where: { asaasCustomerId: { not: null } },
      select: { asaasCustomerId: true },
      take: Math.max(1, limit),
    })
    return rows
      .map((row) => row.asaasCustomerId)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  }
}

export const asaasNotificationBackfillRepository =
  new AsaasNotificationBackfillRepository()
