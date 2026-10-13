import type { AsaasAccountMigration } from "@prisma/client"
import type {
  IAsaasMigrationReadinessRepository,
  MigrationExecutionManifest,
  MigrationGateEvidence,
} from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasMigrationReadinessRepository"

const REQUIRED_GATES: Array<keyof MigrationGateEvidence> = [
  "snapshotSameDay",
  "inventoryVersioned",
  "ledgerReconciled",
  "permanentAccountsExcluded",
  "observabilityActive",
  "lgpdApproved",
    "batchAuthorized",
]

function saoPauloCivilDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export class MigrationReadinessService {
  constructor(private readonly repository: IAsaasMigrationReadinessRepository) {}

  async assertReady(
    migration: AsaasAccountMigration,
    now: Date,
  ): Promise<MigrationExecutionManifest> {
    const manifest = await this.repository.findValidManifest(migration.id, now)
    if (!manifest) throw new Error("Migração sem manifesto aprovado e válido")
    const missingGate = REQUIRED_GATES.find((gate) => manifest.gateEvidence[gate] !== true)
    if (missingGate) throw new Error(`Gate de migração pendente: ${missingGate}`)
    const communicationDecision =
      manifest.gateEvidence.communicationApproved === true ||
      manifest.gateEvidence.communicationWaived === true
    if (!communicationDecision) {
      throw new Error("Gate de migração pendente: communicationApproved_or_communicationWaived")
    }
    if (saoPauloCivilDate(manifest.gateRunAt) !== saoPauloCivilDate(now)) {
      throw new Error("Gate da migração não foi executado no mesmo dia")
    }
    if (!manifest.approvedBy.trim() || !manifest.inventoryHash.trim()) {
      throw new Error("Manifesto de migração incompleto")
    }
    return manifest
  }
}
