import { createHash } from "node:crypto"

export const GRACE_ALIGN_APPLY_ENV = "GRACE_EXPIRY_ALIGN_APPLY"
export const GRACE_ALIGN_OPERATOR_ENV = "GRACE_EXPIRY_ALIGN_OPERATOR_PROFILE_ID"
// Só graces criadas pela liberação em massa são alinhadas; concessões manuais ficam intactas.
export const ALIGNABLE_GRACE_REASON_PREFIX = "bulk_subscription_billing_grace"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type GraceAlignmentCandidate = {
  graceId: string
  teamId: string
  profileId: string
  email: string
  reason: string
  graceExpiresAt: string | null
  memberProExpiresAt: string
  hasActiveAccountBan: boolean
}

export type GraceAlignmentPlan = {
  items: Array<{ graceId: string; teamId: string; profileId: string; email: string; from: string; to: string }>
  skipped: Array<{ graceId: string; email: string; reason: string }>
}

export function buildGraceAlignmentPlan(candidates: readonly GraceAlignmentCandidate[]): GraceAlignmentPlan {
  const items: GraceAlignmentPlan["items"] = []
  const skipped: GraceAlignmentPlan["skipped"] = []
  for (const candidate of [...candidates].sort((left, right) => left.email.localeCompare(right.email))) {
    const skip = (reason: string) => skipped.push({ graceId: candidate.graceId, email: candidate.email, reason })
    if (candidate.hasActiveAccountBan) skip("ban ativo")
    else if (!candidate.reason.startsWith(ALIGNABLE_GRACE_REASON_PREFIX)) skip("grace com outra origem")
    else if (!candidate.graceExpiresAt) skip("grace sem prazo; nada a alinhar")
    else if (new Date(candidate.graceExpiresAt).getTime() >= new Date(candidate.memberProExpiresAt).getTime()) skip("grace já cobre o Member PRO")
    else {
      items.push({
        graceId: candidate.graceId,
        teamId: candidate.teamId,
        profileId: candidate.profileId,
        email: candidate.email,
        from: new Date(candidate.graceExpiresAt).toISOString(),
        to: new Date(candidate.memberProExpiresAt).toISOString(),
      })
    }
  }
  return { items, skipped }
}

export function checksumOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function assertGraceAlignApplyAuthorization(input: {
  apply: boolean
  env: Readonly<Record<string, string | undefined>>
  reportPath?: string
  checksum?: string
}): string | null {
  if (!input.apply) return null
  if (input.env[GRACE_ALIGN_APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${GRACE_ALIGN_APPLY_ENV}=1`)
  if (!input.reportPath || !input.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  const operator = input.env[GRACE_ALIGN_OPERATOR_ENV]
  if (!operator || !UUID_PATTERN.test(operator)) throw new Error(`Recusado: ${GRACE_ALIGN_OPERATOR_ENV} deve ser um UUID real`)
  return operator
}

export interface GraceAlignmentTransaction {
  updateGraceExpiry(input: { graceId: string; teamId: string; from: Date; to: Date }): Promise<number>
  writeChangeLog(input: {
    profileId: string
    actorProfileId: string
    changeType: string
    before: Record<string, unknown>
    after: Record<string, unknown>
    metadata: Record<string, unknown>
  }): Promise<void>
}

export async function applyGraceAlignmentPlan(
  tx: GraceAlignmentTransaction,
  plan: GraceAlignmentPlan,
  operatorProfileId: string,
): Promise<number> {
  for (const item of plan.items) {
    const updated = await tx.updateGraceExpiry({ graceId: item.graceId, teamId: item.teamId, from: new Date(item.from), to: new Date(item.to) })
    if (updated !== 1) throw new Error(`Grace de ${item.email} mudou desde o dry-run; nada foi aplicado`)
    await tx.writeChangeLog({
      profileId: item.profileId,
      actorProfileId: operatorProfileId,
      changeType: "temporary_billing_access_expiry_aligned",
      before: { graceId: item.graceId, expiresAt: item.from },
      after: { graceId: item.graceId, expiresAt: item.to },
      metadata: { teamId: item.teamId, reason: "grace alinhado ao vencimento do Member PRO", asaasMutation: false },
    })
  }
  return plan.items.length
}
