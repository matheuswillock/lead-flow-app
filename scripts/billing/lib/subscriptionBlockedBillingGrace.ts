import { createHash } from "node:crypto"
import { AccountAccessDecisionService } from "@/app/api/services/accountAccessDecision/AccountAccessDecisionService"
import type {
  AccountAccessDecision,
  AccountAccessRecord,
} from "@/app/api/shared/accountAccessDecision/types"
import { isValidAnnualSubscription } from "@/app/api/shared/billing/annualSubscriptionRules"
import {
  isActiveMemberProAssignment,
  isBlockingMemberProAssignment,
} from "@/app/api/shared/billing/memberProBillingRules"

export const SUBSCRIPTION_BLOCKED_GRACE_EXPIRY = "2026-11-19T03:00:00.000Z"
export const SUBSCRIPTION_BLOCKED_GRACE_POLICY_VERSION = 2
export const SUBSCRIPTION_BLOCKED_GRACE_SOURCE = "bulk_subscription_billing_grace"
export const SUBSCRIPTION_BLOCKED_GRACE_REASON_PREFIX = "bulk_subscription_billing_grace"
export const DEFAULT_INCLUDE_EXPIRED_MEMBER_PRO = true
export const DEFAULT_MEMBER_BAN_POLICY = "keep-and-report" as const

export const CENSUS_REASONS = {
  pastDue: "past_due",
  dueDate: "due_date",
  suspended: "suspended",
  canceled: "canceled",
  memberProExpired: "member_pro_expired",
  allowedPermanent: "allowed:permanent",
  allowedAnnual: "allowed:annual",
  allowedMemberPro: "allowed:member_pro",
  allowedGrace: "allowed:grace",
  allowedStatus: "allowed:status",
  bannedMaster: "banned:master",
  reviewSubscriptionUnavailable: "review:subscription_unavailable",
  reviewMultipleExpiredGraces: "review:multiple_expired_graces",
  reviewMasterDeleted: "review:master_deleted",
} as const

export type CensusPolicy = {
  version: number
  expiry: string
  includeExpiredMemberPro: boolean
  memberBanPolicy: typeof DEFAULT_MEMBER_BAN_POLICY
  source: string
}

export const DEFAULT_CENSUS_POLICY: CensusPolicy = {
  version: SUBSCRIPTION_BLOCKED_GRACE_POLICY_VERSION,
  expiry: SUBSCRIPTION_BLOCKED_GRACE_EXPIRY,
  includeExpiredMemberPro: DEFAULT_INCLUDE_EXPIRED_MEMBER_PRO,
  memberBanPolicy: DEFAULT_MEMBER_BAN_POLICY,
  source: SUBSCRIPTION_BLOCKED_GRACE_SOURCE,
}

export type SubscriptionSnapshot = {
  subscriptionStatus: string | null
  subscriptionNextDueDate: Date | null
  hasPermanentSubscription: boolean
  subscriptionCycle: string | null
  subscriptionStartDate: Date | null
  subscriptionEndDate: Date | null
}

export type MemberProAssignmentSnapshot = {
  slug: string
  accessStartsAt: Date | null
  accessExpiresAt: Date | null
} | null

export type BanSnapshot = {
  id: string
  profileId: string
  scope: string
  email: string
  reason: string | null
}

export type GraceSnapshot = {
  id: string
  expiresAt: Date | null
  isActive: boolean
  reason: string
  grantedByProfileId: string | null
  createdAt: Date
}

export type ActiveUserSnapshot = {
  id: string
  email: string
  fullName: string | null
}

export type TeamBillingSnapshot = {
  teamId: string
  teamName: string
  masterId: string
  masterEmail: string
  masterName: string | null
  masterDeleted: boolean
  profileSubscription: SubscriptionSnapshot
  canonicalSubscription: SubscriptionSnapshot | null
  memberPro: MemberProAssignmentSnapshot
  masterBans: BanSnapshot[]
  activeGraces: GraceSnapshot[]
  activeUsers: ActiveUserSnapshot[]
  activeUserBans: BanSnapshot[]
}

export type AccessDecisionSnapshot = {
  state: "allowed" | "restricted"
  reason?: string
}

export type CurrentGraceSummary = {
  id: string
  expiresAt: string | null
  reason: string
  grantedByProfileId: string | null
}

export type BannedActiveUserSummary = {
  profileId: string
  email: string
  scope: string
}

export type MasterBanSummary = {
  banId: string
  scope: string
  email: string
  reason: string | null
}

export type TeamCensusEntry = {
  teamId: string
  teamName: string
  masterId: string
  masterEmail: string
  masterName: string | null
  decision: "included" | "excluded"
  reason: string
  action: "grant" | "repair-expiry" | null
  currentGrace: CurrentGraceSummary | null
  activeUsers: number
  bannedActiveUsers: BannedActiveUserSummary[]
  masterBans: MasterBanSummary[]
  subscriptionStatus: string | null
  subscriptionNextDueDate: string | null
  memberProExpiresAt: string | null
  accessDecision: AccessDecisionSnapshot | null
}

export type CensusSummary = {
  totalTeams: number
  includedTeams: number
  excludedTeams: number
  activeUsersIncluded: number
  bannedActiveUsersIncluded: number
  excludedByReason: Record<string, number>
}

export type CensusReport = {
  generatedAt: string
  apply: false
  policy: CensusPolicy
  summary: CensusSummary
  warnings: string[]
  teams: TeamCensusEntry[]
  excluded: TeamCensusEntry[]
  checksum: string
}

export type ApplyDecision =
  | { action: "apply" }
  | { action: "skip"; reason: string }
  | { action: "conflict"; reason: string }

const accountAccessDecisionService = new AccountAccessDecisionService()

export function resolveEffectiveSubscription(
  snapshot: TeamBillingSnapshot
): SubscriptionSnapshot {
  return snapshot.canonicalSubscription ?? snapshot.profileSubscription
}

export function isDueDateBeforeTodayInSaoPaulo(dueDate: Date, now: Date): boolean {
  const today = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
  return dueDate.toISOString().slice(0, 10) < today
}

export function resolveActiveGrace(
  graces: readonly GraceSnapshot[],
  now: Date
): GraceSnapshot | null {
  const activeGraces = graces.filter((grace) => grace.isActive)
  const indefiniteGrace = activeGraces.find((grace) => grace.expiresAt === null)
  if (indefiniteGrace) return indefiniteGrace

  let selected: GraceSnapshot | null = null
  for (const grace of activeGraces) {
    if (!grace.expiresAt || grace.expiresAt.getTime() <= now.getTime()) continue
    if (
      !selected?.expiresAt ||
      grace.expiresAt.getTime() > selected.expiresAt.getTime()
    ) {
      selected = grace
    }
  }

  return selected
}

export function resolveExpiredActiveGraces(
  graces: readonly GraceSnapshot[],
  now: Date
): GraceSnapshot[] {
  return graces
    .filter(
      (grace) =>
        grace.isActive &&
        grace.expiresAt !== null &&
        grace.expiresAt.getTime() <= now.getTime()
    )
    .sort((left, right) => {
      const leftTime = left.expiresAt?.getTime() ?? 0
      const rightTime = right.expiresAt?.getTime() ?? 0
      return leftTime - rightTime
    })
}

function summarizeBannedActiveUsers(
  snapshot: TeamBillingSnapshot
): BannedActiveUserSummary[] {
  return snapshot.activeUserBans
    .map((ban) => ({
      profileId: ban.profileId,
      email: ban.email,
      scope: ban.scope,
    }))
    .sort(
      (left, right) =>
        left.email.localeCompare(right.email, "pt-BR") ||
        left.profileId.localeCompare(right.profileId)
    )
}

function summarizeMasterBans(snapshot: TeamBillingSnapshot): MasterBanSummary[] {
  return snapshot.masterBans
    .map((ban) => ({
      banId: ban.id,
      scope: ban.scope,
      email: ban.email,
      reason: ban.reason,
    }))
    .sort(
      (left, right) =>
        left.scope.localeCompare(right.scope) ||
        left.banId.localeCompare(right.banId)
    )
}

function toCurrentGraceSummary(grace: GraceSnapshot): CurrentGraceSummary {
  return {
    id: grace.id,
    expiresAt: grace.expiresAt?.toISOString() ?? null,
    reason: grace.reason,
    grantedByProfileId: grace.grantedByProfileId,
  }
}

function buildEntryBase(snapshot: TeamBillingSnapshot) {
  const effectiveSubscription = resolveEffectiveSubscription(snapshot)

  return {
    teamId: snapshot.teamId,
    teamName: snapshot.teamName,
    masterId: snapshot.masterId,
    masterEmail: snapshot.masterEmail,
    masterName: snapshot.masterName,
    activeUsers: snapshot.activeUsers.length,
    bannedActiveUsers: summarizeBannedActiveUsers(snapshot),
    masterBans: summarizeMasterBans(snapshot),
    subscriptionStatus: effectiveSubscription.subscriptionStatus,
    subscriptionNextDueDate:
      effectiveSubscription.subscriptionNextDueDate?.toISOString() ?? null,
    memberProExpiresAt: snapshot.memberPro?.accessExpiresAt?.toISOString() ?? null,
  }
}

function toAccessDecisionSnapshot(
  decision: AccountAccessDecision
): AccessDecisionSnapshot {
  return decision.state === "allowed"
    ? { state: "allowed" }
    : { state: "restricted", reason: decision.reason }
}

function excludedEntry(
  base: ReturnType<typeof buildEntryBase>,
  reason: string,
  accessDecision: AccessDecisionSnapshot | null
): TeamCensusEntry {
  return {
    ...base,
    decision: "excluded",
    reason,
    action: null,
    currentGrace: null,
    accessDecision,
  }
}

function includedEntry(
  base: ReturnType<typeof buildEntryBase>,
  reason: string,
  action: "grant" | "repair-expiry",
  currentGrace: CurrentGraceSummary | null,
  accessDecision: AccessDecisionSnapshot
): TeamCensusEntry {
  return {
    ...base,
    decision: "included",
    reason,
    action,
    currentGrace,
    accessDecision,
  }
}

export function classifyTeamSnapshot(
  snapshot: TeamBillingSnapshot,
  now: Date,
  policy: CensusPolicy = DEFAULT_CENSUS_POLICY
): TeamCensusEntry {
  const base = buildEntryBase(snapshot)

  if (snapshot.masterDeleted) {
    return excludedEntry(base, CENSUS_REASONS.reviewMasterDeleted, null)
  }

  if (snapshot.masterBans.length > 0) {
    return excludedEntry(base, CENSUS_REASONS.bannedMaster, {
      state: "restricted",
      reason: "banned",
    })
  }

  const effectiveSubscription = resolveEffectiveSubscription(snapshot)
  const annualSubscriptionActive = isValidAnnualSubscription(
    snapshot.canonicalSubscription ?? snapshot.profileSubscription,
    now
  )
  const memberProActive = isActiveMemberProAssignment(snapshot.memberPro, now)
  const memberProBlocked = isBlockingMemberProAssignment(snapshot.memberPro, now)
  const activeGrace = resolveActiveGrace(snapshot.activeGraces, now)
  const expiredActiveGraces = resolveExpiredActiveGraces(snapshot.activeGraces, now)

  const account: AccountAccessRecord = {
    billingOwnerId: snapshot.masterId,
    subscriptionStatus: effectiveSubscription.subscriptionStatus,
    subscriptionNextDueDate: effectiveSubscription.subscriptionNextDueDate,
    hasPermanentSubscription: effectiveSubscription.hasPermanentSubscription,
    annualSubscriptionActive,
    memberProActive,
    memberProBlocked,
    temporaryAccessGranted: activeGrace !== null,
    temporaryAccessUntil: activeGrace?.expiresAt ?? null,
    isBanned: false,
  }
  const decision = accountAccessDecisionService.decide(account, now)
  const accessDecision = toAccessDecisionSnapshot(decision)

  if (decision.state === "allowed") {
    const reason = effectiveSubscription.hasPermanentSubscription
      ? CENSUS_REASONS.allowedPermanent
      : annualSubscriptionActive
        ? CENSUS_REASONS.allowedAnnual
        : memberProActive
          ? CENSUS_REASONS.allowedMemberPro
          : activeGrace
            ? CENSUS_REASONS.allowedGrace
            : CENSUS_REASONS.allowedStatus

    return excludedEntry(base, reason, accessDecision)
  }

  if (decision.reason === "past_due") {
    if (memberProBlocked) {
      if (!policy.includeExpiredMemberPro) {
        return excludedEntry(base, CENSUS_REASONS.memberProExpired, accessDecision)
      }

      return includedEntryFromGraces(
        base,
        CENSUS_REASONS.memberProExpired,
        expiredActiveGraces,
        accessDecision
      )
    }

    if (
      effectiveSubscription.subscriptionNextDueDate &&
      isDueDateBeforeTodayInSaoPaulo(
        effectiveSubscription.subscriptionNextDueDate,
        now
      )
    ) {
      return includedEntryFromGraces(
        base,
        CENSUS_REASONS.dueDate,
        expiredActiveGraces,
        accessDecision
      )
    }

    return includedEntryFromGraces(
      base,
      CENSUS_REASONS.pastDue,
      expiredActiveGraces,
      accessDecision
    )
  }

  if (decision.reason === "suspended" || decision.reason === "canceled") {
    return includedEntryFromGraces(
      base,
      decision.reason === "suspended"
        ? CENSUS_REASONS.suspended
        : CENSUS_REASONS.canceled,
      expiredActiveGraces,
      accessDecision
    )
  }

  return excludedEntry(
    base,
    CENSUS_REASONS.reviewSubscriptionUnavailable,
    accessDecision
  )
}

function includedEntryFromGraces(
  base: ReturnType<typeof buildEntryBase>,
  reason: string,
  expiredActiveGraces: readonly GraceSnapshot[],
  accessDecision: AccessDecisionSnapshot
): TeamCensusEntry {
  if (expiredActiveGraces.length > 1) {
    return excludedEntry(
      base,
      CENSUS_REASONS.reviewMultipleExpiredGraces,
      accessDecision
    )
  }

  const currentGrace = expiredActiveGraces[0] ?? null
  return includedEntry(
    base,
    reason,
    currentGrace ? "repair-expiry" : "grant",
    currentGrace ? toCurrentGraceSummary(currentGrace) : null,
    accessDecision
  )
}

function compareEntries(left: TeamCensusEntry, right: TeamCensusEntry): number {
  return (
    left.teamName.localeCompare(right.teamName, "pt-BR") ||
    left.teamId.localeCompare(right.teamId)
  )
}

export function buildCensusReport(
  entries: readonly TeamCensusEntry[],
  now: Date,
  policy: CensusPolicy = DEFAULT_CENSUS_POLICY
): CensusReport {
  const teams = entries
    .filter((entry) => entry.decision === "included")
    .sort(compareEntries)
  const excluded = entries
    .filter((entry) => entry.decision === "excluded")
    .sort(compareEntries)

  const excludedByReason: Record<string, number> = {}
  for (const entry of excluded) {
    excludedByReason[entry.reason] = (excludedByReason[entry.reason] ?? 0) + 1
  }

  const activeUsersIncluded = teams.reduce(
    (total, entry) => total + entry.activeUsers,
    0
  )
  const bannedActiveUsersIncluded = teams.reduce(
    (total, entry) => total + entry.bannedActiveUsers.length,
    0
  )

  const warnings: string[] = []
  const bannedActiveUsers = teams.flatMap((entry) =>
    entry.bannedActiveUsers.map(
      (user) => `${entry.teamName}: ${user.email} (${user.scope})`
    )
  )
  if (bannedActiveUsers.length > 0) {
    warnings.push(
      `Bans individuais permanecem ativos em times incluídos (a grace não remove ban): ${bannedActiveUsers.join(", ")}`
    )
  }

  const bannedMasters = excluded.filter(
    (entry) => entry.reason === CENSUS_REASONS.bannedMaster
  )
  if (bannedMasters.length > 0) {
    warnings.push(
      `Masters banidos excluídos: ${bannedMasters.map((entry) => entry.teamName).join(", ")}`
    )
  }

  const memberProIncluded = teams.filter(
    (entry) => entry.reason === CENSUS_REASONS.memberProExpired
  )
  if (memberProIncluded.length > 0) {
    warnings.push(
      `${memberProIncluded.length} time(s) com Member PRO expirado incluído(s); a grace libera login/acesso, mas não as features do Member PRO`
    )
  }

  const memberProExcluded = excluded.filter(
    (entry) => entry.reason === CENSUS_REASONS.memberProExpired
  )
  if (memberProExcluded.length > 0) {
    warnings.push(
      `${memberProExcluded.length} time(s) Member PRO expirado excluído(s); a grace libera login, mas não as features do Member PRO`
    )
  }

  const reviews = excluded.filter((entry) =>
    entry.reason.startsWith("review:")
  )
  if (reviews.length > 0) {
    warnings.push(
      `Times em revisão manual: ${reviews.map((entry) => `${entry.teamName} (${entry.reason})`).join(", ")}`
    )
  }

  return {
    generatedAt: now.toISOString(),
    apply: false,
    policy,
    summary: {
      totalTeams: entries.length,
      includedTeams: teams.length,
      excludedTeams: excluded.length,
      activeUsersIncluded,
      bannedActiveUsersIncluded,
      excludedByReason,
    },
    warnings,
    teams,
    excluded,
    checksum: computeCensusChecksum(policy, teams),
  }
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "null"
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)

  return `{${entries.join(",")}}`
}

export function computeCensusChecksum(
  policy: CensusPolicy,
  teams: readonly TeamCensusEntry[]
): string {
  return createHash("sha256")
    .update(stableStringify({ policy, teams }))
    .digest("hex")
}

export function assertApprovedCensusPolicy(
  policy: CensusPolicy,
  now: Date = new Date()
): void {
  if (policy.version !== SUBSCRIPTION_BLOCKED_GRACE_POLICY_VERSION) {
    throw new Error("Política de grace divergente: versão não aprovada")
  }
  if (policy.expiry !== SUBSCRIPTION_BLOCKED_GRACE_EXPIRY) {
    throw new Error("Política de grace divergente: expiração não aprovada")
  }
  if (policy.includeExpiredMemberPro !== DEFAULT_INCLUDE_EXPIRED_MEMBER_PRO) {
    throw new Error(
      "Política de grace divergente: inclusão de Member PRO expirado não aprovada"
    )
  }
  if (policy.memberBanPolicy !== DEFAULT_MEMBER_BAN_POLICY) {
    throw new Error("Política de grace divergente: ban de membro deve ser mantido e reportado")
  }
  if (policy.source !== SUBSCRIPTION_BLOCKED_GRACE_SOURCE) {
    throw new Error("Política de grace divergente: source não aprovado")
  }

  const expiry = new Date(policy.expiry)
  if (Number.isNaN(expiry.getTime())) {
    throw new Error("Política de grace inválida: expiração não é uma data ISO")
  }
  if (expiry.getTime() <= now.getTime()) {
    throw new Error("Política de grace expirada; gere uma nova política antes de aplicar")
  }
}

export function resolveApplyDecision(
  planned: TeamCensusEntry,
  current: TeamCensusEntry
): ApplyDecision {
  if (planned.decision !== "included" || planned.action === null) {
    return {
      action: "conflict",
      reason: "entrada planejada não é um time incluído com ação definida",
    }
  }

  if (current.decision === "excluded") {
    return { action: "skip", reason: current.reason }
  }

  if (current.action === null) {
    return {
      action: "conflict",
      reason: "time continua incluído, mas sem ação de grace calculada",
    }
  }

  if (planned.action !== current.action) {
    return {
      action: "conflict",
      reason: `ação mudou de ${planned.action} para ${current.action}`,
    }
  }

  const plannedGraceId = planned.currentGrace?.id ?? null
  const currentGraceId = current.currentGrace?.id ?? null
  if (plannedGraceId !== currentGraceId) {
    return {
      action: "conflict",
      reason: "grace ativa/expiração existente mudou desde o dry-run",
    }
  }

  const plannedGraceExpiry = planned.currentGrace?.expiresAt ?? null
  const currentGraceExpiry = current.currentGrace?.expiresAt ?? null
  if (plannedGraceExpiry !== currentGraceExpiry) {
    return {
      action: "conflict",
      reason: "expiração da grace existente mudou desde o dry-run",
    }
  }

  return { action: "apply" }
}

function formatGraceThroughDate(expiry: string): string {
  const through = new Date(new Date(expiry).getTime() - 1)
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(through)
}

export function buildGraceReason(
  expiry: string = SUBSCRIPTION_BLOCKED_GRACE_EXPIRY
): string {
  return `${SUBSCRIPTION_BLOCKED_GRACE_REASON_PREFIX}: liberação operacional em massa para times bloqueados por assinatura; expiração automática após ${formatGraceThroughDate(expiry)}`
}
