const EXPECTED_OVERRIDE = {
  source: "operational_manual_access_override",
  changeType: "activate_access_pertto_only",
  before: { profileStatus: "past_due", canonicalStatus: "past_due" },
  after: { profileStatus: "active", canonicalStatus: "active" },
  reason: "liberação operacional solicitada",
} as const
export const PERTTO_APPROVED_EXPIRY = "2026-10-28T03:00:00.000Z"

type OverrideLog = {
  source: string
  changeType: string
  before: unknown
  after: unknown
  metadata: unknown
}

export type PerttoGrace = { id: string; expiresAt: Date | null }
export type PerttoPlannedGrace = { id: string; expiresAt: string | null }

function isStatusPair(value: unknown, profileStatus: string, canonicalStatus: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 3 &&
    record.permanent === false &&
    record.profileStatus === profileStatus &&
    record.canonicalStatus === canonicalStatus
}

export function isApprovedPerttoActivationOverride(input: {
  profileStatus: string | null
  canonicalStatus: string | null
  profileAsaasSubscriptionId: string | null
  canonicalAsaasSubscriptionId: string | null
  overrideLog: OverrideLog | null
}): boolean {
  const log = input.overrideLog
  return input.profileStatus === "active" &&
    input.canonicalStatus === "active" &&
    input.profileAsaasSubscriptionId === null &&
    input.canonicalAsaasSubscriptionId === null &&
    log?.source === EXPECTED_OVERRIDE.source &&
    log.changeType === EXPECTED_OVERRIDE.changeType &&
    isStatusPair(log.before, "past_due", "past_due") &&
    isStatusPair(log.after, "active", "active") &&
    (log.metadata as { reason?: unknown; teamId?: unknown; asaasMutation?: unknown } | null)?.reason === EXPECTED_OVERRIDE.reason &&
    (log.metadata as { teamId?: unknown } | null)?.teamId === "862835fd-54ad-4ebd-986a-b5392f1bb227" &&
    (log.metadata as { asaasMutation?: unknown } | null)?.asaasMutation === false
}

export function isExactPerttoCrmEntitlement(featureSlugs: readonly string[]): boolean {
  return featureSlugs.length === 1 && featureSlugs[0] === "crm"
}

export function resolveApprovedPerttoExpiry(value: string | undefined, now = new Date()): string {
  if (!value) throw new Error("Informe --expires-at=<ISO-8601>; o prazo deve ser explícito")
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) {
    throw new Error("--expires-at deve ser uma data futura válida")
  }
  if (date.toISOString() !== PERTTO_APPROVED_EXPIRY) {
    throw new Error("O prazo aprovado para a Pertto é 28/10/2026 00:00 no horário de São Paulo")
  }
  return date.toISOString()
}

export function validatePerttoApplyState(input: {
  profileStatus: string | null
  canonicalStatus: string | null
  profileAsaasSubscriptionId: string | null
  canonicalAsaasSubscriptionId: string | null
  overrideLog: OverrideLog | null
  restorePastDue: boolean
  expiry: string
  plannedGrace: PerttoPlannedGrace | null
  activeGraces: PerttoGrace[]
}): { activeGrace: PerttoGrace | null; alreadyPastDue: boolean; graceAlreadyApplied: boolean } {
  if (input.activeGraces.length > 1) {
    throw new Error("Há múltiplas concessões ativas para a Pertto; operação abortada")
  }
  const activeGrace = input.activeGraces[0] ?? null
  const alreadyPastDue = input.profileStatus === "past_due" && input.canonicalStatus === "past_due"
  const canRestorePastDue = isApprovedPerttoActivationOverride(input)
  const graceMatchesDryRun = input.plannedGrace
    ? activeGrace?.id === input.plannedGrace.id && (activeGrace.expiresAt?.toISOString() ?? null) === input.plannedGrace.expiresAt
    : activeGrace === null
  const graceAlreadyApplied = activeGrace?.expiresAt?.toISOString() === input.expiry
  const restoreStateMatchesDryRun = input.restorePastDue ? canRestorePastDue : alreadyPastDue

  if (!graceMatchesDryRun && !graceAlreadyApplied) throw new Error("A concessão mudou desde o dry-run")
  if (!restoreStateMatchesDryRun) {
    throw new Error("O estado de cobrança mudou desde o dry-run")
  }
  return { activeGrace, alreadyPastDue, graceAlreadyApplied }
}
