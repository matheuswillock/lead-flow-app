import { createHash } from "node:crypto"

export const MEMBER_PRO_EXPIRY_APPLY_ENV = "MEMBER_PRO_EXPIRY_APPLY"
export const MEMBER_PRO_EXPIRY_OPERATOR_ENV = "MEMBER_PRO_EXPIRY_OPERATOR_PROFILE_ID"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

export type MemberProExpiryRequest = { profileId: string; email: string; expiresAt: string; reason: string }

export type MemberProExpirySnapshot = {
  profileId: string
  email: string
  deletedAt: string | null
  hasActiveAccountBan: boolean
  assignment: { slug: string; accessStartsAt: string | null; accessExpiresAt: string | null } | null
}

export type MemberProExpiryPlan = {
  profileId: string
  email: string
  reason: string
  action: "set_member_pro_expiry" | "already-correct"
  from: string
  to: string
}

export function parseRequestedExpiry(value: string | undefined, now: Date): string {
  if (!value || !ISO_UTC_PATTERN.test(value)) throw new Error("Informe --expires-at em ISO-8601 UTC (ex.: 2026-11-27T12:15:57.067Z)")
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) throw new Error("--expires-at deve ser uma data futura válida")
  return date.toISOString()
}

export function buildMemberProExpiryPlan(
  snapshot: MemberProExpirySnapshot,
  request: MemberProExpiryRequest,
  now: Date,
): MemberProExpiryPlan {
  if (snapshot.profileId !== request.profileId || snapshot.email !== request.email || snapshot.deletedAt) {
    throw new Error("Perfil não corresponde ao solicitado")
  }
  if (snapshot.hasActiveAccountBan) throw new Error("Perfil possui ban ativo; operação abortada")
  const { assignment } = snapshot
  if (!assignment || assignment.slug !== "member_pro" || !assignment.accessStartsAt || !assignment.accessExpiresAt) {
    throw new Error("Member PRO ausente ou sem janela completa; resolução manual necessária")
  }
  const to = parseRequestedExpiry(request.expiresAt, now)
  if (new Date(to).getTime() <= new Date(assignment.accessStartsAt).getTime()) {
    throw new Error("A nova expiração precisa ser posterior ao início da janela")
  }
  const from = new Date(assignment.accessExpiresAt).toISOString()
  return {
    profileId: request.profileId,
    email: request.email,
    reason: request.reason,
    action: from === to ? "already-correct" : "set_member_pro_expiry",
    from,
    to,
  }
}

export function checksumOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function assertExpiryApplyAuthorization(input: {
  apply: boolean
  env: Readonly<Record<string, string | undefined>>
  reportPath?: string
  checksum?: string
}): string | null {
  if (!input.apply) return null
  if (input.env[MEMBER_PRO_EXPIRY_APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${MEMBER_PRO_EXPIRY_APPLY_ENV}=1`)
  if (!input.reportPath || !input.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  const operator = input.env[MEMBER_PRO_EXPIRY_OPERATOR_ENV]
  if (!operator || !UUID_PATTERN.test(operator)) throw new Error(`Recusado: ${MEMBER_PRO_EXPIRY_OPERATOR_ENV} deve ser um UUID real`)
  return operator
}

export interface MemberProExpiryTransaction {
  updateMemberProExpiry(input: { profileId: string; from: Date; to: Date }): Promise<number>
  writeChangeLog(input: {
    profileId: string
    actorProfileId: string
    changeType: string
    before: Record<string, unknown>
    after: Record<string, unknown>
    metadata: Record<string, unknown>
  }): Promise<void>
}

export async function applyMemberProExpiryPlan(
  tx: MemberProExpiryTransaction,
  plan: MemberProExpiryPlan,
  operatorProfileId: string,
): Promise<boolean> {
  if (plan.action === "already-correct") return false
  const updated = await tx.updateMemberProExpiry({ profileId: plan.profileId, from: new Date(plan.from), to: new Date(plan.to) })
  if (updated !== 1) throw new Error("Member PRO mudou desde o dry-run; gere um novo relatório")
  await tx.writeChangeLog({
    profileId: plan.profileId,
    actorProfileId: operatorProfileId,
    changeType: "member_pro_access_window_set",
    before: { accessExpiresAt: plan.from },
    after: { accessExpiresAt: plan.to },
    metadata: { reason: plan.reason, asaasMutation: false },
  })
  return true
}
