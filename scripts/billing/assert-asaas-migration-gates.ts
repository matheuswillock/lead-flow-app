import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { prisma } from "@/app/api/infra/data/prisma"
import type { MigrationGateEvidence } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasMigrationReadinessRepository"

const REQUIRED_GATES: Array<keyof MigrationGateEvidence> = [
  "snapshotSameDay",
  "inventoryVersioned",
  "ledgerReconciled",
  "permanentAccountsExcluded",
  "observabilityActive",
  "lgpdApproved",
  "communicationApproved",
  "batchAuthorized",
]

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const migrationId = argument("migration-id")
  const approvedBy = argument("approved-by")
  const inventoryHash = argument("inventory-hash")
  const valueMode = argument("value-mode")
  const evidencePath = argument("evidence")
  const validHours = Number(argument("valid-hours") ?? "24")

  if (!migrationId || !approvedBy || !inventoryHash || !evidencePath) {
    throw new Error("Informe --migration-id, --approved-by, --inventory-hash e --evidence")
  }
  if (!["as-is", "corrected"].includes(valueMode ?? "")) {
    throw new Error("--value-mode deve ser as-is ou corrected")
  }
  if (!Number.isFinite(validHours) || validHours <= 0 || validHours > 24) {
    throw new Error("--valid-hours deve estar entre 1 e 24")
  }

  const evidence = JSON.parse(
    await readFile(resolve(process.cwd(), evidencePath), "utf8"),
  ) as Partial<MigrationGateEvidence>
  const missing = REQUIRED_GATES.filter((gate) => evidence[gate] !== true)
  if (missing.length > 0) throw new Error(`Gates pendentes: ${missing.join(", ")}`)

  const gateRunAt = new Date()
  const validUntil = new Date(gateRunAt.getTime() + validHours * 60 * 60 * 1000)
  const preview = {
    migrationId,
    approvedBy,
    valueMode,
    inventoryHash,
    gateRunAt,
    validUntil,
    gateEvidence: evidence,
  }
  console.info(JSON.stringify({ mode: apply ? "apply" : "dry-run", manifest: preview }, null, 2))
  if (!apply) return
  if (process.env.ASAAS_MIGRATION_GATES_APPLY !== "1") {
    throw new Error("--apply exige ASAAS_MIGRATION_GATES_APPLY=1")
  }

  await prisma.asaasMigrationExecutionManifest.upsert({
    where: { migrationId },
    create: {
      ...preview,
      approved: true,
      valueMode: valueMode!,
      gateEvidence: evidence as MigrationGateEvidence,
    },
    update: {
      approved: true,
      approvedBy,
      valueMode: valueMode!,
      inventoryHash,
      gateRunAt,
      validUntil,
      gateEvidence: evidence as MigrationGateEvidence,
    },
  })
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
