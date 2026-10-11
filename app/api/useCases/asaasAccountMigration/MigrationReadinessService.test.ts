import { describe, expect, it, mock } from "bun:test"
import { MigrationReadinessService } from "./MigrationReadinessService"

const completeEvidence = {
  snapshotSameDay: true,
  inventoryVersioned: true,
  ledgerReconciled: true,
  permanentAccountsExcluded: true,
  observabilityActive: true,
  lgpdApproved: true,
  communicationApproved: true,
  batchAuthorized: true,
}

describe("MigrationReadinessService", () => {
  it("bloqueia quando um gate obrigatório não foi aprovado", async () => {
    const now = new Date("2026-10-10T12:00:00.000Z")
    const service = new MigrationReadinessService({
      findValidManifest: mock(async () => ({
        migrationId: "migration-1",
        approvedBy: "owner",
        valueMode: "as-is" as const,
        inventoryHash: "sha256",
        gateRunAt: now,
        validUntil: new Date("2026-10-11T00:00:00.000Z"),
        gateEvidence: { ...completeEvidence, lgpdApproved: false },
      })),
    })

    await expect(service.assertReady({ id: "migration-1" } as any, now))
      .rejects.toThrow("lgpdApproved")
  })

  it("aceita manifesto completo, válido e produzido no dia", async () => {
    const now = new Date("2026-10-10T12:00:00.000Z")
    const manifest = {
      migrationId: "migration-1",
      approvedBy: "owner",
      valueMode: "corrected" as const,
      inventoryHash: "sha256",
      gateRunAt: now,
      validUntil: new Date("2026-10-11T00:00:00.000Z"),
      gateEvidence: completeEvidence,
    }
    const service = new MigrationReadinessService({
      findValidManifest: mock(async () => manifest),
    })

    await expect(service.assertReady({ id: "migration-1" } as any, now))
      .resolves.toEqual(manifest)
  })
})
