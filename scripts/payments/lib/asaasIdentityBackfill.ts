import { createHash } from "node:crypto"
import type { AsaasProfileIdentityRow } from "@/app/api/infra/data/repositories/paymentCharge/AsaasIdentityBackfillRepository"
import { isRealAsaasSubscriptionId } from "@/lib/payments/asaas-ids"
import type { ProviderIdentityBinding } from "@/lib/payment-provider/identity"
import type { PaymentProviderEnvironment } from "@/lib/payment-provider/types"

type Account = "primary" | "legacy"

export type IdentityCandidate = {
  readonly kind: "CUSTOMER" | "SUBSCRIPTION"
  readonly account: Account
  readonly externalId: string
  readonly ownerType: "PROFILE" | "PROFILE_SUBSCRIPTION"
  readonly ownerId: string
  readonly tenantId: string
}

export type BackfillArgs = { readonly apply: boolean; readonly batchSize: number }

export type BackfillDependencies = {
  readonly listProfiles: (input: { afterId?: string; limit: number }) => Promise<readonly AsaasProfileIdentityRow[]>
  readonly isBound: (candidate: IdentityCandidate) => Promise<boolean>
  readonly bind: (binding: ProviderIdentityBinding) => Promise<unknown>
  readonly environment: PaymentProviderEnvironment
}

export type BackfillResult = {
  readonly mode: "dry-run" | "apply"
  readonly total: number
  readonly toCreate: number
  readonly alreadyBound: number
  readonly applied: number
  readonly conflicts: number
  readonly checksum: string
}

const ROUTE_VERSION = "PAY-LEDGER-BACKFILL-R1"
const DEFAULT_BATCH_SIZE = 200

export function parseBackfillArgs(argv: readonly string[]): BackfillArgs {
  const batchArg = argv.find((arg) => arg.startsWith("--batch-size="))
  const batchSize = batchArg ? Number(batchArg.split("=")[1]) : DEFAULT_BATCH_SIZE
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error("--batch-size deve ser um inteiro entre 1 e 1000")
  }
  return { apply: argv.includes("--apply"), batchSize }
}

export function buildIdentityCandidates(row: AsaasProfileIdentityRow): IdentityCandidate[] {
  const candidates = new Map<string, IdentityCandidate>()
  const add = (candidate: IdentityCandidate) => {
    const key = `${candidate.kind}|${candidate.account}|${candidate.externalId}`
    if (!candidates.has(key)) candidates.set(key, candidate)
  }
  if (row.customerId) {
    add({ kind: "CUSTOMER", account: row.customerAccount, externalId: row.customerId, ownerType: "PROFILE", ownerId: row.profileId, tenantId: row.profileId })
  }
  if (isRealAsaasSubscriptionId(row.subscriptionRowAsaasId) && row.subscriptionRowId) {
    add({
      kind: "SUBSCRIPTION",
      account: row.subscriptionRowAccount ?? "primary",
      externalId: row.subscriptionRowAsaasId,
      ownerType: "PROFILE_SUBSCRIPTION",
      ownerId: row.subscriptionRowId,
      tenantId: row.profileId,
    })
  }
  if (isRealAsaasSubscriptionId(row.profileSubscriptionAsaasId)) {
    const alreadyFromRow = [...candidates.values()].some(
      (c) => c.kind === "SUBSCRIPTION" && c.externalId === row.profileSubscriptionAsaasId && c.account === row.profileSubscriptionAccount,
    )
    if (!alreadyFromRow) {
      add({ kind: "SUBSCRIPTION", account: row.profileSubscriptionAccount, externalId: row.profileSubscriptionAsaasId, ownerType: "PROFILE", ownerId: row.profileId, tenantId: row.profileId })
    }
  }
  return [...candidates.values()]
}

/** Dry-run por padrão; `apply` grava só o que ainda não está vinculado (bind é idempotente). */
export async function runAsaasIdentityBackfill(args: BackfillArgs, deps: BackfillDependencies): Promise<BackfillResult> {
  const lines: string[] = []
  let toCreate = 0
  let alreadyBound = 0
  let applied = 0
  let conflicts = 0
  let afterId: string | undefined

  for (;;) {
    const rows = await deps.listProfiles({ afterId, limit: args.batchSize })
    if (rows.length === 0) break
    for (const row of rows) {
      for (const candidate of buildIdentityCandidates(row)) {
        lines.push([candidate.kind, candidate.account, candidate.externalId, candidate.ownerType, candidate.ownerId].join("|"))
        if (await deps.isBound(candidate)) {
          alreadyBound += 1
          continue
        }
        toCreate += 1
        if (!args.apply) continue
        try {
          await deps.bind(toBinding(candidate, deps.environment))
          applied += 1
        } catch {
          conflicts += 1
        }
      }
    }
    afterId = rows[rows.length - 1].profileId
    if (rows.length < args.batchSize) break
  }

  return {
    mode: args.apply ? "apply" : "dry-run",
    total: lines.length,
    toCreate,
    alreadyBound,
    applied,
    conflicts,
    checksum: createHash("sha256").update([...lines].sort().join("\n")).digest("hex"),
  }
}

function toBinding(candidate: IdentityCandidate, environment: PaymentProviderEnvironment): ProviderIdentityBinding {
  return {
    provider: "ASAAS",
    environment,
    externalAccountContext: candidate.account,
    externalId: candidate.externalId,
    identityType: candidate.kind,
    ownerType: candidate.ownerType,
    ownerId: candidate.ownerId,
    tenantId: candidate.tenantId,
    route: "LEGACY_ASAAS",
    routeVersion: ROUTE_VERSION,
  }
}
