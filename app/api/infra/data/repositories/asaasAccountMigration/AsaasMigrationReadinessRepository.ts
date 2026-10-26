import { prisma } from "@/app/api/infra/data/prisma"

export type MigrationGateEvidence = {
  snapshotSameDay: boolean
  inventoryVersioned: boolean
  ledgerReconciled: boolean
  permanentAccountsExcluded: boolean
  observabilityActive: boolean
  lgpdApproved: boolean
  communicationApproved: boolean
  /** Dispensa formal do owner quando a operação não enviará comunicação. */
  communicationWaived?: boolean
  batchAuthorized: boolean
}

export type MigrationExecutionManifest = {
  migrationId: string
  approvedBy: string
  valueMode: "as-is" | "corrected"
  inventoryHash: string
  gateRunAt: Date
  validUntil: Date
  gateEvidence: MigrationGateEvidence
}

export interface IAsaasMigrationReadinessRepository {
  findValidManifest(migrationId: string, now: Date): Promise<MigrationExecutionManifest | null>
}

export class AsaasMigrationReadinessRepository
  implements IAsaasMigrationReadinessRepository {
  async findValidManifest(
    migrationId: string,
    now: Date,
  ): Promise<MigrationExecutionManifest | null> {
    const manifest = await prisma.asaasMigrationExecutionManifest.findFirst({
      where: {
        migrationId,
        approved: true,
        gateRunAt: { lte: now },
        validUntil: { gt: now },
      },
      select: {
        migrationId: true,
        approvedBy: true,
        valueMode: true,
        inventoryHash: true,
        gateRunAt: true,
        validUntil: true,
        gateEvidence: true,
      },
    })
    if (!manifest || !["as-is", "corrected"].includes(manifest.valueMode)) return null
    return {
      ...manifest,
      valueMode: manifest.valueMode as "as-is" | "corrected",
      gateEvidence: manifest.gateEvidence as MigrationGateEvidence,
    }
  }
}

export const asaasMigrationReadinessRepository =
  new AsaasMigrationReadinessRepository()
