import { createHash } from "node:crypto"

export const REVERT_ID = "reconciliation-block-revert-2026-10-20"
export const REVERT_APPLY_ENV = "RECONCILIATION_BLOCK_REVERT_APPLY"
export const REVERT_OPERATOR_ENV = "RECONCILIATION_BLOCK_REVERT_OPERATOR_PROFILE_ID"

// Mudanças posteriores ao bloqueio que não alteram o estado de cobrança do perfil.
export const BENIGN_LATER_CHANGE_TYPES: ReadonlySet<string> = new Set([
  "member_pro_access_window_normalized",
  "indefinite_billing_access_granted",
])

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BlockedProfileSnapshot = {
  profileId: string
  email: string
  profileStatus: string | null
  canonicalStatus: string | null
  hasActiveAccountBan: boolean
  reconciliationLog: { before: unknown; after: unknown } | null
  laterChangeTypes: string[]
  memberPro: { accessStartsAt: string | null; accessExpiresAt: string | null } | null
}

export type RevertDecision =
  | { profileId: string; email: string; eligible: true }
  | { profileId: string; email: string; eligible: false; reason: string }

export type RevertPlan = {
  revertId: string
  eligible: Array<{ profileId: string; email: string }>
  skipped: Array<{ profileId: string; email: string; reason: string }>
}

function readStatusPair(value: unknown): [unknown, unknown] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return [record.profileStatus, record.profileSubscriptionStatus]
}

function isMemberProActive(memberPro: BlockedProfileSnapshot["memberPro"], now: Date): boolean {
  if (!memberPro?.accessExpiresAt) return false
  const startsAt = memberPro.accessStartsAt ? new Date(memberPro.accessStartsAt).getTime() : Number.NEGATIVE_INFINITY
  return startsAt <= now.getTime() && new Date(memberPro.accessExpiresAt).getTime() > now.getTime()
}

export function classifyBlockedProfile(snapshot: BlockedProfileSnapshot, now: Date): RevertDecision {
  const skip = (reason: string): RevertDecision => ({ profileId: snapshot.profileId, email: snapshot.email, eligible: false, reason })
  if (snapshot.hasActiveAccountBan) return skip("ban ativo")
  if (snapshot.profileStatus !== "suspended" || snapshot.canonicalStatus !== "suspended") {
    return skip(`status atual ${snapshot.profileStatus}/${snapshot.canonicalStatus} não é suspended/suspended`)
  }
  const before = readStatusPair(snapshot.reconciliationLog?.before)
  const after = readStatusPair(snapshot.reconciliationLog?.after)
  if (!(before?.[0] === "active" && before[1] === "active" && after?.[0] === "suspended" && after[1] === "suspended")) {
    return skip("o bloqueio não veio de active/active pela reconciliação")
  }
  const unexpected = snapshot.laterChangeTypes.filter((type) => !BENIGN_LATER_CHANGE_TYPES.has(type))
  if (unexpected.length > 0) return skip(`mudança posterior ao bloqueio: ${[...new Set(unexpected)].join(", ")}`)
  if (!isMemberProActive(snapshot.memberPro, now)) return skip("Member PRO não está vigente; contrato não comprovado")
  return { profileId: snapshot.profileId, email: snapshot.email, eligible: true }
}

export function buildRevertPlan(snapshots: readonly BlockedProfileSnapshot[], now: Date): RevertPlan {
  const decisions = snapshots.map((snapshot) => classifyBlockedProfile(snapshot, now))
  const byEmail = (left: { email: string }, right: { email: string }) => left.email.localeCompare(right.email)
  return {
    revertId: REVERT_ID,
    eligible: decisions
      .flatMap((decision) => (decision.eligible ? [{ profileId: decision.profileId, email: decision.email }] : []))
      .sort(byEmail),
    skipped: decisions
      .flatMap((decision) => (decision.eligible ? [] : [{ profileId: decision.profileId, email: decision.email, reason: decision.reason }]))
      .sort(byEmail),
  }
}

export function checksumOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function assertRevertApplyAuthorization(input: {
  apply: boolean
  env: Readonly<Record<string, string | undefined>>
  reportPath?: string
  checksum?: string
}): string | null {
  if (!input.apply) return null
  if (input.env[REVERT_APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${REVERT_APPLY_ENV}=1`)
  if (!input.reportPath || !input.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  const operator = input.env[REVERT_OPERATOR_ENV]
  if (!operator || !UUID_PATTERN.test(operator)) throw new Error(`Recusado: ${REVERT_OPERATOR_ENV} deve ser um UUID real`)
  return operator
}

export interface RevertTransaction {
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

export async function applyRevertPlan(tx: RevertTransaction, plan: RevertPlan, operatorProfileId: string): Promise<number> {
  for (const target of plan.eligible) {
    const restored = await tx.restoreSubscriptionStatus({ profileId: target.profileId })
    if (restored.profile !== 1 || restored.canonical !== 1) {
      throw new Error(`Status de ${target.email} mudou desde o dry-run; nada foi aplicado`)
    }
    await tx.writeChangeLog({
      profileId: target.profileId,
      actorProfileId: operatorProfileId,
      changeType: "reconciliation_block_reverted",
      before: { profileStatus: "suspended", profileSubscriptionStatus: "suspended" },
      after: { profileStatus: "active", profileSubscriptionStatus: "active" },
      metadata: { revertId: plan.revertId, reason: "suspensão pela reconciliação (due-after-end) com Member PRO vigente", asaasMutation: false },
    })
  }
  return plan.eligible.length
}
