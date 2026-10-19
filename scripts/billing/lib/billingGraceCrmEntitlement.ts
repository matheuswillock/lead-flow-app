import { createHash } from "node:crypto"
import { isBlockingMemberProAssignment } from "@/app/api/shared/billing/memberProBillingRules"

export const BILLING_GRACE_CRM_ENTITLEMENT_POLICY_VERSION = 1
export const BILLING_GRACE_CRM_ENTITLEMENT_SOURCE =
  "billing_grace_crm_entitlement"
export const BILLING_GRACE_CRM_ENTITLEMENT_EXPIRY =
  "2026-11-19T03:00:00.000Z"
export const BILLING_GRACE_CRM_ENTITLEMENT_CHANGE_TYPE =
  "temporary_crm_entitlement_granted"
export const BILLING_GRACE_CRM_ENTITLEMENT_APPLY_ENV =
  "BILLING_GRACE_CRM_ENTITLEMENT_APPLY"
export const BILLING_GRACE_OPERATOR_ENV = "BILLING_GRACE_OPERATOR_PROFILE_ID"
export const DEFAULT_CRM_PRODUCT_ID = "afc702a8-c991-4432-8cca-3e95757f7ca1"
export const DEFAULT_CRM_PRODUCT_NAME = "CRM"
export const REQUIRED_CRM_FEATURE_SLUG = "crm"
export const EXPECTED_CRM_ENTITLEMENT_TEAMS = 24

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const CRM_ENTITLEMENT_REASONS = {
  included: "included:grace_without_product",
  masterDeleted: "excluded:master_deleted",
  masterBanned: "excluded:master_banned",
  noBatchGrace: "excluded:no_batch_grace",
  multipleBatchGraces: "excluded:multiple_batch_graces",
  memberProExpired: "excluded:member_pro_expired",
  permanent: "excluded:permanent",
  profileProduct: "excluded:profile_product",
  activeBackofficeSubscription: "excluded:active_backoffice_subscription",
  existingCrmEntitlement: "excluded:existing_crm_entitlement",
  alreadyEntitled: "excluded:already_entitled_crm",
} as const

export type CrmEntitlementPolicy = {
  version: number
  expiry: string
  source: string
  operatorProfileId: string
  productId: string
  productName: string
  requiredFeatureSlug: string
}

export type CrmProductSnapshot = {
  id: string
  name: string
  featureSlugs: string[]
  isActive: boolean
  type: string
}

export type ProfileProductSnapshot = {
  productId: string
  productName: string
  featureSlugs: string[]
}

export type BackofficeSubscriptionSnapshot = {
  id: string
  productId: string
  productName: string
  featureSlugs: string[]
  status: string
  startDate: Date | null
  endDate: Date | null
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

export type TeamCrmEntitlementSnapshot = {
  teamId: string
  teamName: string
  masterId: string
  masterEmail: string
  masterName: string | null
  masterDeleted: boolean
  profileSubscriptionStatus: string | null
  hasPermanentAccess: boolean
  profileProduct: ProfileProductSnapshot | null
  activeBackofficeSubscriptions: BackofficeSubscriptionSnapshot[]
  existingCrmEntitlements: BackofficeSubscriptionSnapshot[]
  memberPro: MemberProAssignmentSnapshot
  masterBans: BanSnapshot[]
  activeGraces: GraceSnapshot[]
  activeUsers: ActiveUserSnapshot[]
  activeUserBans: BanSnapshot[]
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

export type CrmEntitlementEntry = {
  teamId: string
  teamName: string
  masterId: string
  masterEmail: string
  masterName: string | null
  activeUsers: number
  bannedActiveUsers: BannedActiveUserSummary[]
  masterBans: MasterBanSummary[]
  subscriptionStatus: string | null
  memberProExpiresAt: string | null
  hasPermanentAccess: boolean
  profileProduct: ProfileProductSnapshot | null
  activeBackofficeSubscriptions: BackofficeSubscriptionSnapshot[]
  existingCrmEntitlements: BackofficeSubscriptionSnapshot[]
  graceId: string | null
  graceExpiresAt: string | null
  productId: string
  productName: string
  requiredFeatureSlug: string
  currentFeatureSlugs: string[]
  currentCrmAccess: boolean
  decision: "included" | "excluded"
  reason: string
  action: "create" | null
}

export type CrmEntitlementSummary = {
  totalTeams: number
  includedTeams: number
  excludedTeams: number
  activeUsersIncluded: number
  bannedActiveUsersIncluded: number
  excludedByReason: Record<string, number>
}

export type CrmEntitlementReport = {
  generatedAt: string
  apply: false
  policy: CrmEntitlementPolicy
  product: CrmProductSnapshot
  summary: CrmEntitlementSummary
  warnings: string[]
  teams: CrmEntitlementEntry[]
  excluded: CrmEntitlementEntry[]
  checksum: string
}

export type CrmApplyDecision =
  | { action: "apply" }
  | { action: "skip"; reason: string }
  | { action: "conflict"; reason: string }

export function createCrmEntitlementPolicy(
  operatorProfileId: string
): CrmEntitlementPolicy {
  return {
    version: BILLING_GRACE_CRM_ENTITLEMENT_POLICY_VERSION,
    expiry: BILLING_GRACE_CRM_ENTITLEMENT_EXPIRY,
    source: BILLING_GRACE_CRM_ENTITLEMENT_SOURCE,
    operatorProfileId,
    productId: DEFAULT_CRM_PRODUCT_ID,
    productName: DEFAULT_CRM_PRODUCT_NAME,
    requiredFeatureSlug: REQUIRED_CRM_FEATURE_SLUG,
  }
}

export function resolveBatchGraces(
  graces: readonly GraceSnapshot[],
  policy: CrmEntitlementPolicy
): GraceSnapshot[] {
  return graces.filter(
    (grace) =>
      grace.isActive &&
      grace.expiresAt?.toISOString() === policy.expiry &&
      grace.grantedByProfileId === policy.operatorProfileId
  )
}

function summarizeBannedActiveUsers(
  snapshot: TeamCrmEntitlementSnapshot
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

function summarizeMasterBans(
  snapshot: TeamCrmEntitlementSnapshot
): MasterBanSummary[] {
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

function entryBase(
  snapshot: TeamCrmEntitlementSnapshot,
  policy: CrmEntitlementPolicy
): Omit<CrmEntitlementEntry, "decision" | "reason" | "action"> {
  return {
    teamId: snapshot.teamId,
    teamName: snapshot.teamName,
    masterId: snapshot.masterId,
    masterEmail: snapshot.masterEmail,
    masterName: snapshot.masterName,
    activeUsers: snapshot.activeUsers.length,
    bannedActiveUsers: summarizeBannedActiveUsers(snapshot),
    masterBans: summarizeMasterBans(snapshot),
    subscriptionStatus: snapshot.profileSubscriptionStatus,
    memberProExpiresAt:
      snapshot.memberPro?.accessExpiresAt?.toISOString() ?? null,
    hasPermanentAccess: snapshot.hasPermanentAccess,
    profileProduct: snapshot.profileProduct,
    activeBackofficeSubscriptions: snapshot.activeBackofficeSubscriptions,
    existingCrmEntitlements: snapshot.existingCrmEntitlements,
    graceId: null,
    graceExpiresAt: null,
    productId: policy.productId,
    productName: policy.productName,
    requiredFeatureSlug: policy.requiredFeatureSlug,
    currentFeatureSlugs: [],
    currentCrmAccess: false,
  }
}

function excludedEntry(
  base: Omit<CrmEntitlementEntry, "decision" | "reason" | "action">,
  reason: string
): CrmEntitlementEntry {
  return {
    ...base,
    decision: "excluded",
    reason,
    action: null,
  }
}

export function classifyTeamCrmEntitlement(
  snapshot: TeamCrmEntitlementSnapshot,
  policy: CrmEntitlementPolicy,
  now: Date
): CrmEntitlementEntry {
  const base = entryBase(snapshot, policy)

  if (snapshot.masterDeleted) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.masterDeleted)
  }

  if (snapshot.masterBans.length > 0) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.masterBanned)
  }

  const batchGraces = resolveBatchGraces(snapshot.activeGraces, policy)
  if (batchGraces.length === 0) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.noBatchGrace)
  }
  if (batchGraces.length > 1) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.multipleBatchGraces)
  }

  if (isBlockingMemberProAssignment(snapshot.memberPro, now)) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.memberProExpired)
  }

  if (snapshot.hasPermanentAccess) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.permanent)
  }

  if (snapshot.profileProduct) {
    return excludedEntry(base, CRM_ENTITLEMENT_REASONS.profileProduct)
  }

  if (snapshot.activeBackofficeSubscriptions.length > 0) {
    return excludedEntry(
      base,
      CRM_ENTITLEMENT_REASONS.activeBackofficeSubscription
    )
  }

  if (snapshot.existingCrmEntitlements.length > 0) {
    return excludedEntry(
      base,
      CRM_ENTITLEMENT_REASONS.existingCrmEntitlement
    )
  }

  const grace = batchGraces[0]
  return {
    ...base,
    graceId: grace.id,
    graceExpiresAt: grace.expiresAt?.toISOString() ?? null,
    decision: "included",
    reason: CRM_ENTITLEMENT_REASONS.included,
    action: "create",
  }
}

function compareEntries(
  left: CrmEntitlementEntry,
  right: CrmEntitlementEntry
): number {
  return (
    left.teamName.localeCompare(right.teamName, "pt-BR") ||
    left.teamId.localeCompare(right.teamId)
  )
}

export function buildCrmEntitlementReport(
  entries: readonly CrmEntitlementEntry[],
  policy: CrmEntitlementPolicy,
  product: CrmProductSnapshot,
  now: Date
): CrmEntitlementReport {
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

  const warnings: string[] = [
    "Grant temporário de CRM via BackofficeUserSubscription; não altera Asaas, assinatura canônica nem bans.",
  ]

  const bannedActiveUsers = teams.flatMap((entry) =>
    entry.bannedActiveUsers.map(
      (user) => `${entry.teamName}: ${user.email} (${user.scope})`
    )
  )
  if (bannedActiveUsers.length > 0) {
    warnings.push(
      `Bans individuais permanecem ativos nos times incluídos (o grant não remove ban): ${bannedActiveUsers.join(", ")}`
    )
  }

  const memberProExcluded = excluded.filter(
    (entry) => entry.reason === CRM_ENTITLEMENT_REASONS.memberProExpired
  )
  if (memberProExcluded.length > 0) {
    warnings.push(
      `${memberProExcluded.length} time(s) Member PRO expirado excluído(s); continuam login-only e sem as features do Member PRO`
    )
  }

  const profileProductExcluded = excluded.filter(
    (entry) => entry.reason === CRM_ENTITLEMENT_REASONS.profileProduct
  )
  if (profileProductExcluded.length > 0) {
    warnings.push(
      `Times com produto já vinculado excluídos (sem novo grant): ${profileProductExcluded.map((entry) => entry.teamName).join(", ")}`
    )
  }

  const existingCrmExcluded = excluded.filter(
    (entry) => entry.reason === CRM_ENTITLEMENT_REASONS.existingCrmEntitlement
  )
  if (existingCrmExcluded.length > 0) {
    warnings.push(
      `Times com registro de CRM já existente (revisão manual, sem overwrite): ${existingCrmExcluded.map((entry) => entry.teamName).join(", ")}`
    )
  }

  const activeBackofficeExcluded = excluded.filter(
    (entry) => entry.reason === CRM_ENTITLEMENT_REASONS.activeBackofficeSubscription
  )
  if (activeBackofficeExcluded.length > 0) {
    warnings.push(
      `Times com assinatura de produto ativa excluídos: ${activeBackofficeExcluded.map((entry) => entry.teamName).join(", ")}`
    )
  }

  const alreadyEntitled = excluded.filter(
    (entry) => entry.reason === CRM_ENTITLEMENT_REASONS.alreadyEntitled
  )
  if (alreadyEntitled.length > 0) {
    warnings.push(
      `Times que já resolvem CRM pelo feature access atual foram excluídos: ${alreadyEntitled.map((entry) => entry.teamName).join(", ")}`
    )
  }

  return {
    generatedAt: now.toISOString(),
    apply: false,
    policy,
    product,
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
    checksum: computeCrmEntitlementChecksum(policy, teams),
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

export function computeCrmEntitlementChecksum(
  policy: CrmEntitlementPolicy,
  teams: readonly CrmEntitlementEntry[]
): string {
  const payload = JSON.parse(
    JSON.stringify({ policy, teams })
  ) as unknown

  return createHash("sha256").update(stableStringify(payload)).digest("hex")
}

export function assertApprovedCrmEntitlementPolicy(
  policy: CrmEntitlementPolicy,
  product: CrmProductSnapshot,
  now: Date = new Date()
): void {
  if (policy.version !== BILLING_GRACE_CRM_ENTITLEMENT_POLICY_VERSION) {
    throw new Error("Política de entitlement CRM divergente: versão não aprovada")
  }
  if (policy.expiry !== BILLING_GRACE_CRM_ENTITLEMENT_EXPIRY) {
    throw new Error("Política de entitlement CRM divergente: expiração não aprovada")
  }
  if (policy.source !== BILLING_GRACE_CRM_ENTITLEMENT_SOURCE) {
    throw new Error("Política de entitlement CRM divergente: source não aprovado")
  }
  if (!UUID_PATTERN.test(policy.operatorProfileId)) {
    throw new Error("Política de entitlement CRM inválida: operador não é um UUID real")
  }
  if (policy.productId !== DEFAULT_CRM_PRODUCT_ID) {
    throw new Error("Política de entitlement CRM divergente: produto não aprovado")
  }
  if (policy.productName !== DEFAULT_CRM_PRODUCT_NAME) {
    throw new Error("Política de entitlement CRM divergente: nome do produto não aprovado")
  }
  if (policy.requiredFeatureSlug !== REQUIRED_CRM_FEATURE_SLUG) {
    throw new Error("Política de entitlement CRM divergente: feature não aprovada")
  }

  const expiry = new Date(policy.expiry)
  if (Number.isNaN(expiry.getTime())) {
    throw new Error("Política de entitlement CRM inválida: expiração não é ISO")
  }
  if (expiry.getTime() <= now.getTime()) {
    throw new Error("Política de entitlement CRM expirada; não aplicar")
  }

  if (product.id !== policy.productId) {
    throw new Error("Produto CRM do dry-run divergente do produto aprovado")
  }
  if (product.name !== policy.productName) {
    throw new Error("Produto CRM do dry-run com nome divergente")
  }
  if (!product.isActive) {
    throw new Error("Produto CRM está inativo")
  }
  if (product.type !== "PLAN") {
    throw new Error("Produto CRM não é do tipo PLAN")
  }
  if (
    product.featureSlugs.length !== 1 ||
    product.featureSlugs[0] !== policy.requiredFeatureSlug
  ) {
    throw new Error(
      `Produto CRM com featureSlugs divergentes do aprovado: ${product.featureSlugs.join(", ")}`
    )
  }
}

export function resolveApplyDecision(
  planned: CrmEntitlementEntry,
  current: CrmEntitlementEntry
): CrmApplyDecision {
  if (planned.decision !== "included" || planned.action !== "create") {
    return {
      action: "conflict",
      reason: "entrada planejada não é um grant de CRM válido",
    }
  }

  if (planned.teamName !== current.teamName) {
    return { action: "conflict", reason: "nome do time mudou desde o dry-run" }
  }
  if (planned.masterId !== current.masterId) {
    return { action: "conflict", reason: "master do time mudou desde o dry-run" }
  }

  if (current.decision === "excluded") {
    return { action: "skip", reason: current.reason }
  }

  if (current.action !== "create") {
    return {
      action: "conflict",
      reason: "time continua elegível, mas sem ação de criação de CRM",
    }
  }

  if (planned.graceId !== current.graceId) {
    return {
      action: "conflict",
      reason: "grace do lote mudou desde o dry-run",
    }
  }

  if (planned.graceExpiresAt !== current.graceExpiresAt) {
    return {
      action: "conflict",
      reason: "expiração da grace mudou desde o dry-run",
    }
  }

  if (planned.productId !== current.productId) {
    return {
      action: "conflict",
      reason: "produto do grant mudou desde o dry-run",
    }
  }

  return { action: "apply" }
}
