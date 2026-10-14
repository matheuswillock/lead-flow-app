import { createHash } from "node:crypto"
import { chmodSync, readFileSync, writeFileSync } from "node:fs"
import { AuditAction, AuditEntityType } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { createAsaasClient } from "@/lib/asaas/asaas-client"
import { getFullUrl } from "@/lib/utils/app-url"
import {
  createBillingCheckoutToken,
  hashBillingCheckoutToken,
} from "@/lib/billing/billingCheckoutIntent"
import { billingCheckoutIntentRepository } from "@/app/api/infra/data/repositories/billingCheckoutIntent/BillingCheckoutIntentRepository"
import type { AsaasCustomer } from "./lib/asaasInventoryTypes"
import {
  BRUNO_PROFILE_ID,
  TEAM_OWNERSHIP_TRANSFER_TARGETS,
  buildTeamOwnershipTransferPlan,
  type TeamOwnershipTransferPlan,
} from "./lib/teamOwnershipTransfer"

const MIGRATION_ID = "bruno-team-ownership-transfer-2026-10-14"
const DEFAULT_ACTOR_PROFILE_ID = "f88f2b3b-3f45-4170-83e1-4e7999d2c012"

type Arguments = {
  apply: boolean
  input?: string
  output?: string
  checksum?: string
  actorProfileId: string
}

type TeamSnapshot = {
  id: string
  name: string
  masterId: string
  isDefault: boolean
  deletedAt: string | null
  memberIds: string[]
}

type ProfileSnapshot = {
  id: string
  email: string
  fullName: string | null
  deletedAt: string | null
  isMaster: boolean
  managerId: string | null
  activeTeamId: string | null
  hasPermanentSubscription: boolean
  subscriptionStatus: string | null
  asaasCustomerId: string | null
  asaasCustomerAccount: string
  asaasSubscriptionId: string | null
  subscription: {
    id: string
    hasPermanentSubscription: boolean
    subscriptionStatus: string | null
    asaasSubscriptionId: string | null
  } | null
}

type RemoteProvisioningItem = {
  profileId: string
  email: string
  externalReference: string
  customerAction: "create" | "reuse" | "link-existing"
  customerId: string | null
  checkoutAction: "awaiting-method" | "already-created"
  checkoutId: string | null
  checkoutUrl: string | null
  checkoutToken: string | null
  billingType: "PIX" | "CREDIT_CARD" | null
  cycle: "monthly"
  price: number | null
}

type MembershipSnapshot = {
  id: string
  teamId: string
  profileId: string
  role: string
  functions: string[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  canViewAllTeams: boolean
}

type SourceDefaultRepair = {
  teamId: string
  teamName: string
  reason: "transferred_default_replaced"
} | null

type TransferReport = {
  generatedAt: string
  apply: boolean
  outcome?: "planned" | "applying" | "applied"
  migrationId: string
  actorProfileId: string
  source: { profileId: string; email: string }
  sourceActiveTeamBefore: string | null
  sourceActiveTeamAfter: string | null
  plan: TeamOwnershipTransferPlan
  remoteProvisioning: RemoteProvisioningItem[]
  sourceDefaultRepair: SourceDefaultRepair
  before: { teams: TeamSnapshot[]; profiles: ProfileSnapshot[]; memberships: MembershipSnapshot[] }
  after: { teams: TeamSnapshot[]; profiles: ProfileSnapshot[]; memberships: MembershipSnapshot[] }
  checksum: string
}

function parseArguments(argv: string[]): Arguments {
  const value = (name: string) => argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
  return {
    apply: argv.includes("--apply"),
    input: value("input"),
    output: value("output"),
    checksum: value("checksum"),
    actorProfileId: value("actor-profile-id") ?? DEFAULT_ACTOR_PROFILE_ID,
  }
}

function assertApplyAuthorization(args: Arguments): void {
  if (!args.output) {
    throw new Error("Recusado: --output=<relatorio.json> é obrigatório para preservar o token do checkout")
  }
  if (!args.apply) return
  if (process.env.TEAM_OWNERSHIP_TRANSFER_APPLY !== "1") {
    throw new Error("Recusado: --apply exige TEAM_OWNERSHIP_TRANSFER_APPLY=1")
  }
  if (process.env.ASAAS_ENV !== "production") {
    throw new Error("Recusado: --apply com onboarding Asaas exige ASAAS_ENV=production")
  }
  if (!args.input || !args.checksum) {
    throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  }
}

function uniqueTargetProfileIds(): string[] {
  return [...new Set(TEAM_OWNERSHIP_TRANSFER_TARGETS.map((target) => target.profileId))]
}

function uniqueTargetTeamIds(): string[] {
  return TEAM_OWNERSHIP_TRANSFER_TARGETS.map((target) => target.teamId)
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => nestedValue instanceof Date ? nestedValue.toISOString() : nestedValue)
}

function checkoutExternalReference(profileId: string): string {
  return `billing-intent:${profileId}`
}

function createDryRunCheckoutToken(): string {
  return createBillingCheckoutToken().token
}

export function calculateChecksum(report: Omit<TransferReport, "checksum" | "generatedAt" | "apply" | "outcome">): string {
  return createHash("sha256").update(stableJson(report)).digest("hex")
}

async function assertActor(client: typeof prisma, actorProfileId: string): Promise<void> {
  const actor = await client.backofficeUser.findFirst({
    where: { profileId: actorProfileId, isActive: true, fullAccess: true },
    select: { profileId: true },
  })
  if (!actor) throw new Error(`Ator ${actorProfileId} não é um operador backoffice ativo com acesso total`)
}

async function loadCensus(client: typeof prisma): Promise<TransferReport["before"]> {
  const [teams, profiles] = await Promise.all([
    client.team.findMany({
      where: { id: { in: uniqueTargetTeamIds() } },
      select: {
        id: true,
        name: true,
        masterId: true,
        isDefault: true,
        deletedAt: true,
        members: { select: { id: true } },
      },
      orderBy: { id: "asc" },
    }),
    client.profile.findMany({
      where: { id: { in: uniqueTargetProfileIds() } },
      select: {
        id: true,
        email: true,
        fullName: true,
        deletedAt: true,
        isMaster: true,
        managerId: true,
        activeTeamId: true,
        hasPermanentSubscription: true,
        subscriptionStatus: true,
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        asaasSubscriptionId: true,
        subscription: {
          select: {
            id: true,
            hasPermanentSubscription: true,
            subscriptionStatus: true,
            asaasSubscriptionId: true,
          },
        },
      },
      orderBy: { id: "asc" },
    }),
  ])

  const memberships = await client.teamMember.findMany({
    where: { teamId: { in: uniqueTargetTeamIds() } },
    select: {
      id: true,
      teamId: true,
      profileId: true,
      role: true,
      functions: true,
      canCreateAccountUsers: true,
      canManageAccountTeams: true,
      canTransferAccountLeads: true,
      canViewAllTeams: true,
    },
    orderBy: { id: "asc" },
  })

  return {
    teams: teams.map((team) => ({ id: team.id, name: team.name, masterId: team.masterId, isDefault: team.isDefault, deletedAt: toIso(team.deletedAt), memberIds: team.members.map((member) => member.id).sort() })),
    profiles: profiles.map((profile) => ({
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      deletedAt: toIso(profile.deletedAt),
      isMaster: profile.isMaster,
      managerId: profile.managerId,
      activeTeamId: profile.activeTeamId,
      hasPermanentSubscription: profile.hasPermanentSubscription,
      subscriptionStatus: profile.subscriptionStatus,
      asaasCustomerId: profile.asaasCustomerId,
      asaasCustomerAccount: profile.asaasCustomerAccount,
      asaasSubscriptionId: profile.asaasSubscriptionId,
      subscription: profile.subscription,
    })),
    memberships,
  }
}

async function findRemoteCustomer(client: ReturnType<typeof createAsaasClient>, profile: ProfileSnapshot): Promise<AsaasCustomer | null> {
  if (profile.asaasCustomerId && profile.asaasCustomerAccount !== "primary") {
    throw new Error(`Perfil ${profile.email} possui customer Asaas fora da conta primary; onboarding abortado`)
  }
  const response = await client.request(
    `${client.endpoints.customers}?externalReference=${encodeURIComponent(profile.id)}`,
    { method: "GET" },
  )
  const customers = Array.isArray(response?.data) ? response.data as AsaasCustomer[] : []
  if (customers.length > 1) throw new Error(`Múltiplos customers Asaas para profile ${profile.id}`)
  const customer = customers[0] ?? null
  if (profile.asaasCustomerId && customer?.id !== profile.asaasCustomerId) {
    throw new Error(`Ponteiro Asaas divergente para ${profile.email}`)
  }
  if (customer) {
    if (customer.email.trim().toLowerCase() !== profile.email.trim().toLowerCase()) {
      throw new Error(`E-mail do customer Asaas divergente para ${profile.email}`)
    }
    if (profile.fullName && customer.name.trim().toLowerCase() !== profile.fullName.trim().toLowerCase()) {
      throw new Error(`Nome do customer Asaas divergente para ${profile.email}`)
    }
  }
  return customer
}

async function buildRemoteProvisioningPlan(before: TransferReport["before"]): Promise<RemoteProvisioningItem[]> {
  const client = createAsaasClient("primary")

  const profiles = [...new Map(before.profiles.map((profile) => [profile.id, profile])).values()]
  const result: RemoteProvisioningItem[] = []
  for (const profile of profiles) {
    const customer = await findRemoteCustomer(client, profile)
    const externalReference = checkoutExternalReference(profile.id)
    const existingIntent = await billingCheckoutIntentRepository.findByExternalReference(externalReference, "primary")
    const checkoutToken = existingIntent ? null : createDryRunCheckoutToken()
    result.push({
      profileId: profile.id,
      email: profile.email,
      externalReference,
      customerAction: customer ? (profile.asaasCustomerId ? "reuse" : "link-existing") : "create",
      customerId: customer?.id ?? null,
      checkoutAction: existingIntent?.checkoutId ? "already-created" : "awaiting-method",
      checkoutId: existingIntent?.checkoutId ?? null,
      checkoutUrl: existingIntent?.checkoutUrl ?? (checkoutToken ? getFullUrl(`/checkout/${checkoutToken}`) : null),
      checkoutToken,
      billingType: existingIntent?.billingType === "PIX" || existingIntent?.billingType === "CREDIT_CARD"
        ? existingIntent.billingType
        : null,
      cycle: "monthly",
      price: existingIntent?.amount ? Number(existingIntent.amount.toString()) : null,
    })
  }
  return result
}

async function loadSourceDefaultRepair(client: typeof prisma): Promise<SourceDefaultRepair> {
  const selectedIds = new Set(uniqueTargetTeamIds())
  const sourceTeams = await client.team.findMany({
    where: { masterId: BRUNO_PROFILE_ID, deletedAt: null },
    select: { id: true, name: true, isDefault: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
  if (sourceTeams.some((team) => !selectedIds.has(team.id) && team.isDefault)) return null
  const replacement = sourceTeams.find((team) => !selectedIds.has(team.id))
  return replacement ? { teamId: replacement.id, teamName: replacement.name, reason: "transferred_default_replaced" } : null
}

function buildAfterSnapshot(
  before: TransferReport["before"],
  plan: TeamOwnershipTransferPlan,
): TransferReport["after"] {
  const transferredTeams = new Map(plan.transfers.map((item) => [item.teamId, item]))
  const teams = before.teams.map((team) => {
    const transfer = transferredTeams.get(team.id)
    return transfer
      ? { ...team, masterId: transfer.targetMasterId, isDefault: transfer.shouldBeDefault }
      : team
  })
  const profiles = before.profiles.map((profile) => {
    const update = plan.profileUpdates.find((item) => item.profileId === profile.id)
    return update
      ? { ...profile, activeTeamId: update.defaultTeamId, isMaster: true, managerId: null, hasPermanentSubscription: false, subscriptionStatus: "past_due", subscription: profile.subscription ? { ...profile.subscription, hasPermanentSubscription: false, subscriptionStatus: "past_due" } : null }
      : profile
  })
  return { teams, profiles, memberships: before.memberships }
}

async function buildReport(actorProfileId: string): Promise<TransferReport> {
  await assertActor(prisma, actorProfileId)
  const sourceRecord = await prisma.profile.findUnique({ where: { id: BRUNO_PROFILE_ID }, select: { id: true, email: true, activeTeamId: true } })
  const source = sourceRecord ? { profileId: sourceRecord.id, email: sourceRecord.email } : null
  if (!source) throw new Error("Profile do Bruno não encontrado")
  const before = await loadCensus(prisma)
  const plan = buildTeamOwnershipTransferPlan({
    teams: before.teams.map((team) => ({ ...team, deletedAt: team.deletedAt ? new Date(team.deletedAt) : null })),
    profiles: before.profiles.map((profile) => ({ ...profile, deletedAt: profile.deletedAt ? new Date(profile.deletedAt) : null })),
    memberships: before.memberships.map((membership) => ({ ...membership, role: membership.role as "manager" | "operator" })),
  })
  for (const profile of before.profiles) {
    if (profile.asaasSubscriptionId || profile.subscription?.asaasSubscriptionId) {
      throw new Error(`Perfil ${profile.id} possui assinatura Asaas; transferência abortada para evitar cobrança indevida`)
    }
  }
  const sourceDefaultRepair = await loadSourceDefaultRepair(prisma)
  const after = buildAfterSnapshot(before, plan)
  const sourceActiveTeamAfter = sourceRecord && sourceDefaultRepair && uniqueTargetTeamIds().includes(sourceRecord.activeTeamId ?? "")
    ? sourceDefaultRepair.teamId
    : sourceRecord?.activeTeamId ?? null
  const remoteProvisioning = await buildRemoteProvisioningPlan(before)
  const reportWithoutChecksum = { migrationId: MIGRATION_ID, actorProfileId, source, sourceActiveTeamBefore: sourceRecord?.activeTeamId ?? null, sourceActiveTeamAfter, plan, remoteProvisioning, sourceDefaultRepair, before, after }
  return { generatedAt: new Date().toISOString(), apply: false, ...reportWithoutChecksum, checksum: calculateChecksum(reportWithoutChecksum) }
}

export function readDryRunReport(path: string, checksum: string): TransferReport {
  const report = JSON.parse(readFileSync(path, "utf-8")) as TransferReport
  const {
    checksum: reportedChecksum,
    generatedAt: _generatedAt,
    apply: _apply,
    outcome: _outcome,
    ...checksumPayload
  } = report
  if (reportedChecksum !== checksum || calculateChecksum(checksumPayload) !== checksum) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  return report
}

function assertNoBlockedItems(report: TransferReport): void {
  if (report.plan.blocked.length > 0) {
    throw new Error(`Censo bloqueado: ${report.plan.blocked.map((item) => `${item.teamName}:${item.reason}`).join(", ")}`)
  }
}

function assertCurrentMatchesBeforeOrAfter(current: TransferReport["before"], report: TransferReport): void {
  const expectedTeamStates = new Map(report.before.teams.map((team) => [team.id, team]))
  const afterTeamStates = new Map(report.after.teams.map((team) => [team.id, team]))
  for (const team of current.teams) {
    const before = expectedTeamStates.get(team.id)
    const after = afterTeamStates.get(team.id)
    if (!before || !after || (stableJson(team) !== stableJson(before) && stableJson(team) !== stableJson(after))) {
      throw new Error(`Time ${team.name} mudou desde o dry-run; operação abortada`)
    }
  }
  const beforeProfiles = new Map(report.before.profiles.map((profile) => [profile.id, profile]))
  const afterProfiles = new Map(report.after.profiles.map((profile) => [profile.id, profile]))
  const normalizeProfileForOwnership = (profile: ProfileSnapshot): ProfileSnapshot => ({
    ...profile,
    // O onboarding remoto pode ter vinculado um customer depois do dry-run.
    // Esse ponteiro é validado novamente por externalReference antes de cada POST.
    asaasCustomerId: null,
  })
  for (const profile of current.profiles) {
    const before = beforeProfiles.get(profile.id)
    const after = afterProfiles.get(profile.id)
    if (!before || !after || (stableJson(normalizeProfileForOwnership(profile)) !== stableJson(normalizeProfileForOwnership(before)) && stableJson(normalizeProfileForOwnership(profile)) !== stableJson(normalizeProfileForOwnership(after)))) {
      throw new Error(`Perfil ${profile.email} mudou desde o dry-run; operação abortada`)
    }
  }
  if (stableJson(current.memberships) !== stableJson(report.before.memberships)) {
    throw new Error("Memberships mudaram desde o dry-run; operação abortada")
  }
}

async function applyTransfer(report: TransferReport): Promise<void> {
  assertNoBlockedItems(report)
  await prisma.$transaction(async (transaction) => {
    await assertActor(transaction as typeof prisma, report.actorProfileId)
    const current = await loadCensus(transaction as typeof prisma)
    assertCurrentMatchesBeforeOrAfter(current, report)

    const currentSource = await transaction.profile.findUnique({ where: { id: BRUNO_PROFILE_ID }, select: { id: true, email: true, activeTeamId: true } })
    if (!currentSource || currentSource.email !== report.source.email) throw new Error("Profile do Bruno mudou desde o dry-run")
    if (currentSource.activeTeamId !== report.sourceActiveTeamBefore && currentSource.activeTeamId !== report.sourceActiveTeamAfter) {
      throw new Error("activeTeamId do Bruno mudou desde o dry-run; operação abortada")
    }
    if (currentSource.activeTeamId !== report.sourceActiveTeamAfter && report.sourceActiveTeamAfter) {
      await transaction.profile.update({ where: { id: BRUNO_PROFILE_ID }, data: { activeTeamId: report.sourceActiveTeamAfter } })
      await transaction.auditLog.create({
        data: {
          entityType: AuditEntityType.PROFILE,
          entityId: BRUNO_PROFILE_ID,
          action: AuditAction.UPDATE,
          actorProfileId: report.actorProfileId,
          before: { activeTeamId: currentSource.activeTeamId },
          after: { activeTeamId: report.sourceActiveTeamAfter },
          metadata: { migrationId: report.migrationId, reason: "source_default_team_replaced", asaasMutation: false },
        },
      })
    }

    for (const item of report.plan.transfers) {
      const team = await transaction.team.findUnique({ where: { id: item.teamId }, select: { id: true, name: true, masterId: true, isDefault: true } })
      if (!team) throw new Error(`Time ${item.teamName} desapareceu durante a aplicação`)
      if (team.masterId !== BRUNO_PROFILE_ID && team.masterId !== item.targetMasterId) throw new Error(`Owner divergente no time ${item.teamName}`)
      if (team.masterId !== item.targetMasterId || team.isDefault !== item.shouldBeDefault) {
        await transaction.team.update({ where: { id: item.teamId }, data: { masterId: item.targetMasterId, isDefault: item.shouldBeDefault } })
        await transaction.auditLog.create({
          data: {
            entityType: AuditEntityType.TEAM,
            entityId: item.teamId,
            action: AuditAction.UPDATE,
            actorProfileId: report.actorProfileId,
            before: { masterId: team.masterId, isDefault: team.isDefault },
            after: { masterId: item.targetMasterId, isDefault: item.shouldBeDefault },
            metadata: { migrationId: report.migrationId, sourceMasterId: BRUNO_PROFILE_ID, targetMasterId: item.targetMasterId, asaasMutation: false },
          },
        })
      }
    }

    if (report.sourceDefaultRepair) {
      const currentSourceDefaults = await transaction.team.findMany({
        where: { masterId: BRUNO_PROFILE_ID, deletedAt: null, isDefault: true },
        select: { id: true },
      })
      const selectedTeamIds = new Set(uniqueTargetTeamIds())
      if (currentSourceDefaults.some((team) => !selectedTeamIds.has(team.id) && team.id !== report.sourceDefaultRepair?.teamId)) {
        throw new Error("Mais de um time padrão permaneceu na conta do Bruno; operação abortada")
      }
      const replacement = await transaction.team.findUnique({ where: { id: report.sourceDefaultRepair.teamId }, select: { masterId: true, isDefault: true } })
      if (!replacement || replacement.masterId !== BRUNO_PROFILE_ID) throw new Error("Time padrão substituto do Bruno mudou; operação abortada")
      if (!replacement.isDefault) await transaction.team.update({ where: { id: report.sourceDefaultRepair.teamId }, data: { isDefault: true } })
    }

    for (const profileUpdate of report.plan.profileUpdates) {
      const currentProfile = await transaction.profile.findUnique({
        where: { id: profileUpdate.profileId },
        select: { id: true, email: true, deletedAt: true, isMaster: true, managerId: true, activeTeamId: true, hasPermanentSubscription: true, subscriptionStatus: true, subscription: { select: { id: true, hasPermanentSubscription: true, subscriptionStatus: true } } },
      })
      if (!currentProfile || currentProfile.email.trim().toLowerCase() !== profileUpdate.email.trim().toLowerCase()) throw new Error(`Perfil alvo divergente: ${profileUpdate.profileId}`)
      if (currentProfile.deletedAt) throw new Error(`Perfil alvo excluído: ${profileUpdate.profileId}`)
      if (
        currentProfile.isMaster &&
        currentProfile.managerId === null &&
        currentProfile.activeTeamId === profileUpdate.defaultTeamId &&
        !currentProfile.hasPermanentSubscription &&
        currentProfile.subscriptionStatus === "past_due" &&
        (!currentProfile.subscription || (!currentProfile.subscription.hasPermanentSubscription && currentProfile.subscription.subscriptionStatus === "past_due"))
      ) continue
      const before = { isMaster: currentProfile.isMaster, managerId: currentProfile.managerId, activeTeamId: currentProfile.activeTeamId, hasPermanentSubscription: currentProfile.hasPermanentSubscription, subscriptionStatus: currentProfile.subscriptionStatus }
      await transaction.profile.update({ where: { id: profileUpdate.profileId }, data: { isMaster: true, managerId: null, activeTeamId: profileUpdate.defaultTeamId, hasPermanentSubscription: false, subscriptionStatus: "past_due" } })
      if (currentProfile.subscription) {
        await transaction.profileSubscription.update({ where: { profileId: profileUpdate.profileId }, data: { hasPermanentSubscription: false, subscriptionStatus: "past_due" } })
      }
      await transaction.auditLog.create({
        data: {
          entityType: AuditEntityType.PROFILE,
          entityId: profileUpdate.profileId,
          action: AuditAction.UPDATE,
          actorProfileId: report.actorProfileId,
          before,
          after: { isMaster: true, managerId: null, activeTeamId: profileUpdate.defaultTeamId, hasPermanentSubscription: false, subscriptionStatus: "past_due" },
          metadata: { migrationId: report.migrationId, reason: "transferred_account_requires_checkout", asaasMutation: false },
        },
      })
      await transaction.subscriptionChangeLog.create({
        data: {
          profileId: profileUpdate.profileId,
          source: "bruno_team_ownership_transfer",
          actorProfileId: report.actorProfileId,
          changeType: "development_access_revoked_pending_checkout",
          eventType: "overdue",
          before,
          after: { isMaster: true, managerId: null, activeTeamId: profileUpdate.defaultTeamId, hasPermanentSubscription: false, subscriptionStatus: "past_due" },
          metadata: { migrationId: report.migrationId, asaasMutation: false, checkoutRequired: true },
        },
      })
    }
  })
}

async function loadBillingProfile(profileId: string): Promise<{
  id: string
  email: string
  fullName: string | null
  phone: string | null
  cpfCnpj: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  asaasCustomerId: string | null
  asaasCustomerAccount: string
  asaasSubscriptionId: string | null
  isMaster: boolean
  managerId: string | null
}> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true, email: true, fullName: true, phone: true, cpfCnpj: true,
      postalCode: true, address: true, addressNumber: true, neighborhood: true,
      complement: true, asaasCustomerId: true, asaasCustomerAccount: true,
      asaasSubscriptionId: true, isMaster: true, managerId: true,
    },
  })
  if (!profile) throw new Error(`Perfil ${profileId} desapareceu antes do onboarding Asaas`)
  return profile
}

async function applyRemoteProvisioning(report: TransferReport): Promise<void> {
  const client = createAsaasClient("primary")
  for (const item of report.remoteProvisioning) {
    const profile = await loadBillingProfile(item.profileId)
    if (profile.asaasSubscriptionId) throw new Error(`Perfil ${profile.email} já possui assinatura Asaas; operação abortada`)
    if (!profile.isMaster || profile.managerId !== null) throw new Error(`Perfil ${profile.email} deixou de ser master; operação abortada`)
    if (profile.email.trim().toLowerCase() !== item.email.trim().toLowerCase()) throw new Error(`E-mail do perfil ${item.profileId} mudou; operação abortada`)
    if (profile.asaasCustomerId && profile.asaasCustomerAccount !== "primary") {
      throw new Error(`Perfil ${profile.email} possui customer fora da conta primary; operação abortada`)
    }

    const remoteCustomer = await findRemoteCustomer(client, {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      deletedAt: null,
      isMaster: true,
      managerId: null,
      activeTeamId: null,
      hasPermanentSubscription: false,
      subscriptionStatus: "past_due",
      asaasCustomerId: profile.asaasCustomerId,
      asaasCustomerAccount: profile.asaasCustomerAccount,
      asaasSubscriptionId: null,
      subscription: null,
    })
    const customerId = remoteCustomer?.id ?? (await client.request(client.endpoints.customers, {
      method: "POST",
      body: JSON.stringify({
        name: profile.fullName || profile.email,
        email: profile.email,
        cpfCnpj: profile.cpfCnpj?.replace(/\D/g, "") || undefined,
        phone: profile.phone?.replace(/\D/g, "") || undefined,
        postalCode: profile.postalCode?.replace(/\D/g, "") || undefined,
        address: profile.address || undefined,
        addressNumber: profile.addressNumber || undefined,
        complement: profile.complement || undefined,
        province: profile.neighborhood || undefined,
        externalReference: profile.id,
        notificationDisabled: true,
      }),
    })).then((created: { id?: unknown }) => {
      if (typeof created?.id !== "string" || created.id.length === 0) throw new Error(`Asaas não retornou customer para ${profile.email}`)
      return created.id
    })

    if (profile.asaasCustomerId !== customerId) {
      await prisma.profile.update({ where: { id: profile.id }, data: { asaasCustomerId: customerId, asaasCustomerAccount: "primary" } })
      await prisma.auditLog.create({
        data: {
          entityType: AuditEntityType.PROFILE,
          entityId: profile.id,
          action: AuditAction.UPDATE,
          actorProfileId: report.actorProfileId,
          before: { asaasCustomerId: profile.asaasCustomerId, asaasCustomerAccount: profile.asaasCustomerAccount },
          after: { asaasCustomerId: customerId, asaasCustomerAccount: "primary" },
          metadata: { migrationId: report.migrationId, reason: "primary_customer_provisioned", asaasMutation: true },
        },
      })
    }

    const existingIntent = await billingCheckoutIntentRepository.findByExternalReference(item.externalReference, "primary")
    if (existingIntent) {
      item.customerId = customerId
      item.checkoutAction = existingIntent.checkoutId ? "already-created" : "awaiting-method"
      item.checkoutId = existingIntent.checkoutId
      item.checkoutUrl = existingIntent.checkoutUrl
      item.checkoutToken = null
      item.billingType = existingIntent.billingType === "PIX" || existingIntent.billingType === "CREDIT_CARD"
        ? existingIntent.billingType
        : null
      item.price = existingIntent.amount ? Number(existingIntent.amount.toString()) : null
      continue
    }

    if (!item.checkoutToken) {
      throw new Error(`Token do checkout ausente no dry-run para ${profile.email}; gere um novo relatório`)
    }
    const token = {
      token: item.checkoutToken,
      tokenHash: hashBillingCheckoutToken(item.checkoutToken),
      tokenPreview: `${item.checkoutToken.slice(0, 8)}…`,
    }
    const intent = await billingCheckoutIntentRepository.create({
      profileId: profile.id,
      asaasCustomerId: customerId,
      asaasAccount: "primary",
      productSlug: "crm",
      productId: null,
      cycle: item.cycle,
      externalReference: item.externalReference,
      tokenHash: token.tokenHash,
      tokenPreview: token.tokenPreview,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    item.customerId = customerId
    item.checkoutToken = token.token
    item.checkoutUrl = getFullUrl(`/checkout/${token.token}`)
    item.checkoutAction = "awaiting-method"
    await prisma.auditLog.create({
      data: {
        entityType: AuditEntityType.PROFILE,
        entityId: profile.id,
        action: AuditAction.UPDATE,
        actorProfileId: report.actorProfileId,
        before: { billingCheckoutIntent: null },
        after: { billingCheckoutIntentId: intent.id, externalReference: item.externalReference, status: "awaiting_method" },
        metadata: { migrationId: report.migrationId, asaasMutation: true, paymentDeferredUntilMethodSelection: true },
      },
    })
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  const report = args.apply ? readDryRunReport(args.input!, args.checksum!) : await buildReport(args.actorProfileId)
  if (!args.apply) assertNoBlockedItems(report)
  const writeReport = (outcome: string) => {
    const output = { ...report, apply: args.apply, outcome }
    writeFileSync(args.output!, JSON.stringify(output, null, 2), { encoding: "utf-8", mode: 0o600 })
    chmodSync(args.output!, 0o600)
  }
  if (args.apply) {
    writeReport("applying")
    await applyTransfer(report)
    await applyRemoteProvisioning(report)
  }
  const output = { ...report, apply: args.apply, outcome: args.apply ? "applied" : "planned" }
  writeReport(output.outcome)
  process.stdout.write(`${JSON.stringify({
    migrationId: output.migrationId,
    outcome: output.outcome,
    checksum: output.checksum,
    transferCount: output.plan.transfers.length,
    remoteProvisioningCount: output.remoteProvisioning.length,
  })}\n`)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("[transfer-bruno-teams] erro fatal:", error)
    process.exitCode = 1
  }).finally(() => prisma.$disconnect())
}
