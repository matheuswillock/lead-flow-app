import { createHash } from "node:crypto"
import { MEMBER_PRO_ACCESS_DAYS } from "@/app/api/shared/billing/memberProBillingRules"

export const REPAIR_ID = "erick-serafim-team-access-repair-2026-10-20"
export const REPAIR_APPLY_ENV = "ERICK_SERAFIM_ACCESS_APPLY"
export const REPAIR_OPERATOR_ENV = "ERICK_SERAFIM_OPERATOR_PROFILE_ID"

export const ERICK_TARGET = {
  profileId: "f94a3014-2ada-4aea-958e-49294fe7dc16",
  teamId: "5a615581-9ee1-4040-b2b7-76d5d0acf41a",
  teamName: "One Master",
  email: "erickserafimm@gmail.com",
} as const

const DAY_MS = 24 * 60 * 60 * 1000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReconciliationLog = { before: unknown; after: unknown; metadata: unknown }

export type ErickAccessSnapshot = {
  profile: {
    id: string
    email: string
    isMaster: boolean
    deletedAt: string | null
    subscriptionStatus: string | null
  }
  canonicalSubscriptionStatus: string | null
  assignment: { slug: string; accessStartsAt: string | null; accessExpiresAt: string | null } | null
  team: { id: string; name: string; masterId: string; deletedAt: string | null } | null
  hasActiveAccountBan: boolean
  reconciliationLog: ReconciliationLog | null
}

export type ErickAccessAction =
  | { kind: "shorten_member_pro"; from: string; to: string }
  | { kind: "restore_subscription_status"; from: "suspended"; to: "active" }

export type ErickAccessPlan = {
  repairId: string
  target: typeof ERICK_TARGET
  actions: ErickAccessAction[]
}

function readStatusPair(value: unknown): { profile: unknown; subscription: unknown } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return { profile: record.profileStatus, subscription: record.profileSubscriptionStatus }
}

// A suspensão só é revertida quando o log prova que o estado anterior era active/active
// e que ela veio da reconciliação (não de ban, cancelamento ou inadimplência real).
function wasSuspendedOnlyByReconciliation(log: ReconciliationLog | null): boolean {
  const before = readStatusPair(log?.before)
  const after = readStatusPair(log?.after)
  return (
    before?.profile === "active" &&
    before.subscription === "active" &&
    after?.profile === "suspended" &&
    after.subscription === "suspended"
  )
}

export function resolveMemberProExpiry(accessStartsAt: string): string {
  return new Date(new Date(accessStartsAt).getTime() + MEMBER_PRO_ACCESS_DAYS * DAY_MS).toISOString()
}

function assertTargetMatches(snapshot: ErickAccessSnapshot): void {
  const { profile, team } = snapshot
  if (profile.id !== ERICK_TARGET.profileId || profile.email !== ERICK_TARGET.email || !profile.isMaster || profile.deletedAt) {
    throw new Error("Master não corresponde ao censo aprovado")
  }
  if (!team || team.id !== ERICK_TARGET.teamId || team.name !== ERICK_TARGET.teamName || team.masterId !== profile.id || team.deletedAt) {
    throw new Error("Time não corresponde ao censo aprovado")
  }
  if (snapshot.hasActiveAccountBan) throw new Error("Master possui ban ativo; operação abortada")
}

function planMemberProWindow(snapshot: ErickAccessSnapshot): ErickAccessAction[] {
  const { assignment } = snapshot
  if (!assignment || assignment.slug !== "member_pro" || !assignment.accessStartsAt || !assignment.accessExpiresAt) {
    throw new Error("Member PRO ausente ou sem janela completa; resolução manual necessária")
  }
  const target = resolveMemberProExpiry(assignment.accessStartsAt)
  const current = new Date(assignment.accessExpiresAt).toISOString()
  if (current === target) return []
  if (current < target) throw new Error("A janela atual já é menor que a aprovada; este script só encurta")
  return [{ kind: "shorten_member_pro", from: current, to: target }]
}

function planSubscriptionStatus(snapshot: ErickAccessSnapshot): ErickAccessAction[] {
  const profileStatus = snapshot.profile.subscriptionStatus
  const canonicalStatus = snapshot.canonicalSubscriptionStatus
  if (profileStatus === "active" && canonicalStatus === "active") return []
  if (profileStatus !== "suspended" || canonicalStatus !== "suspended") {
    throw new Error("Status de cobrança fora do esperado (suspended/suspended ou active/active)")
  }
  if (!wasSuspendedOnlyByReconciliation(snapshot.reconciliationLog)) {
    throw new Error("Suspensão não é atribuível exclusivamente à reconciliação; resolução manual necessária")
  }
  return [{ kind: "restore_subscription_status", from: "suspended", to: "active" }]
}

export function buildErickAccessPlan(snapshot: ErickAccessSnapshot): ErickAccessPlan {
  assertTargetMatches(snapshot)
  return {
    repairId: REPAIR_ID,
    target: ERICK_TARGET,
    actions: [...planMemberProWindow(snapshot), ...planSubscriptionStatus(snapshot)],
  }
}

export function checksumOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function assertApplyAuthorization(input: {
  apply: boolean
  env: Readonly<Record<string, string | undefined>>
  reportPath?: string
  checksum?: string
}): string | null {
  if (!input.apply) return null
  if (input.env[REPAIR_APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${REPAIR_APPLY_ENV}=1`)
  if (!input.reportPath || !input.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  const operator = input.env[REPAIR_OPERATOR_ENV]
  if (!operator || !UUID_PATTERN.test(operator)) throw new Error(`Recusado: ${REPAIR_OPERATOR_ENV} deve ser um UUID real`)
  return operator
}

export interface AccessRepairTransaction {
  updateMemberProExpiry(input: { profileId: string; from: Date; to: Date }): Promise<number>
  restoreSubscriptionStatus(input: { profileId: string }): Promise<{ profile: number; canonical: number }>
  writeChangeLog(input: {
    profileId: string
    actorProfileId: string
    changeType: string
    before: Record<string, unknown>
    after: Record<string, unknown>
    metadata: Record<string, unknown>
  }): Promise<void>
}

export async function applyErickAccessPlan(
  tx: AccessRepairTransaction,
  plan: ErickAccessPlan,
  operatorProfileId: string,
): Promise<void> {
  const profileId = plan.target.profileId
  for (const action of plan.actions) {
    if (action.kind === "shorten_member_pro") {
      const updated = await tx.updateMemberProExpiry({ profileId, from: new Date(action.from), to: new Date(action.to) })
      if (updated !== 1) throw new Error("Member PRO mudou desde o dry-run; gere um novo relatório")
      await tx.writeChangeLog({
        profileId,
        actorProfileId: operatorProfileId,
        changeType: "member_pro_access_window_shortened",
        before: { accessExpiresAt: action.from },
        after: { accessExpiresAt: action.to },
        metadata: { repairId: plan.repairId, accessDays: MEMBER_PRO_ACCESS_DAYS, asaasMutation: false },
      })
    }
    if (action.kind === "restore_subscription_status") {
      const restored = await tx.restoreSubscriptionStatus({ profileId })
      if (restored.profile !== 1 || restored.canonical !== 1) throw new Error("Status de cobrança mudou desde o dry-run; gere um novo relatório")
      await tx.writeChangeLog({
        profileId,
        actorProfileId: operatorProfileId,
        changeType: "reconciliation_block_reverted",
        before: { profileStatus: action.from, profileSubscriptionStatus: action.from },
        after: { profileStatus: action.to, profileSubscriptionStatus: action.to },
        metadata: { repairId: plan.repairId, reason: "suspensão indevida por reconciliação (due-after-end com nextDueDate inconsistente)", asaasMutation: false },
      })
    }
  }
}
