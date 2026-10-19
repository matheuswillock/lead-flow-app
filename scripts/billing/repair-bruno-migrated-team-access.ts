import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import { TEAM_OWNERSHIP_TRANSFER_TARGETS, BRUNO_PROFILE_ID } from "./lib/teamOwnershipTransfer"

export const REPAIR_ID = "bruno-migrated-team-access-repair-2026-10-19"
export const REPAIR_APPLY_ENV = "BRUNO_MIGRATED_ACCESS_APPLY"
export const REPAIR_EXPIRY = "2026-11-19T03:00:00.000Z"
export const CRM_PRODUCT_ID = "afc702a8-c991-4432-8cca-3e95757f7ca1"
export const ACTOR_PROFILE_ID = "f88f2b3b-3f45-4170-83e1-4e7999d2c012"

const CRM_REQUIRED_PROFILE_IDS = new Set([
  "2a72272f-56f2-4104-9952-5d3d8b19ff1d",
  "8794ad67-aa37-4f98-b1d3-bfd19ceaebf5",
  "d11dca3a-5828-47a7-a993-59fe383e36ba",
])

const INDEFINITE_GRACE_TEAMS = new Set([
  "27edf455-e61a-48a9-a846-e2c6f42999b5",
  "ebe67fdd-2e23-43c0-8e9b-8abec2682d09",
  "760fc14a-229e-4212-9aa9-f90de968af69",
])

type MembershipSnapshot = {
  id: string
  role: string
  functions: string[]
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  canViewAllTeams: boolean
}

export type RepairSnapshot = {
  teamId: string
  teamName: string
  ownerId: string
  ownerEmail: string
  crmSubscriptionId: string | null
  activeGrace: { id: string; expiresAt: Date | null } | null
  brunoMembership: MembershipSnapshot | null
}

export type RepairAction =
  | { kind: "create_subscription"; teamId: string; ownerId: string }
  | { kind: "expire_grace"; teamId: string; graceId: string }
  | { kind: "create_membership"; teamId: string }
  | { kind: "update_membership"; teamId: string; membershipId: string }

export function buildRepairActions(snapshots: readonly RepairSnapshot[]): RepairAction[] {
  const actions: RepairAction[] = []

  for (const snapshot of snapshots) {
    if (CRM_REQUIRED_PROFILE_IDS.has(snapshot.ownerId) && !snapshot.crmSubscriptionId) {
      actions.push({ kind: "create_subscription", teamId: snapshot.teamId, ownerId: snapshot.ownerId })
    }

    if (INDEFINITE_GRACE_TEAMS.has(snapshot.teamId) && snapshot.activeGrace?.expiresAt === null) {
      actions.push({ kind: "expire_grace", teamId: snapshot.teamId, graceId: snapshot.activeGrace.id })
    }

    if (!snapshot.brunoMembership) {
      actions.push({ kind: "create_membership", teamId: snapshot.teamId })
      continue
    }

    if (
      snapshot.brunoMembership.role !== "manager" ||
      !snapshot.brunoMembership.canManageAccountTeams ||
      !snapshot.brunoMembership.canCreateAccountUsers
    ) {
      actions.push({ kind: "update_membership", teamId: snapshot.teamId, membershipId: snapshot.brunoMembership.id })
    }
  }

  return actions.sort((left, right) => `${left.kind}:${left.teamId}`.localeCompare(`${right.kind}:${right.teamId}`))
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

async function loadSnapshots(db: typeof prisma): Promise<RepairSnapshot[]> {
  const teamIds = TEAM_OWNERSHIP_TRANSFER_TARGETS.map((target) => target.teamId)
  const teams = await db.team.findMany({
    where: { id: { in: teamIds }, deletedAt: null },
    select: {
      id: true,
      name: true,
      masterId: true,
      master: { select: { email: true } },
      members: {
        where: { profileId: BRUNO_PROFILE_ID },
        select: {
          id: true,
          role: true,
          functions: true,
          canCreateAccountUsers: true,
          canManageAccountTeams: true,
          canTransferAccountLeads: true,
          canViewAllTeams: true,
        },
      },
    },
  })

  const [subscriptions, graces] = await Promise.all([
    db.backofficeUserSubscription.findMany({
      where: {
        profileId: { in: teams.map((team) => team.masterId) },
        productId: CRM_PRODUCT_ID,
        status: "active",
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      select: { id: true, profileId: true },
    }),
    db.billingAccessGrace.findMany({
      where: { teamId: { in: teamIds }, isActive: true },
      select: { id: true, teamId: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const subscriptionByOwner = new Map(subscriptions.map((item) => [item.profileId, item.id]))
  const graceByTeam = new Map<string, { id: string; expiresAt: Date | null }>()
  for (const grace of graces) {
    if (!graceByTeam.has(grace.teamId)) graceByTeam.set(grace.teamId, { id: grace.id, expiresAt: grace.expiresAt })
  }

  const snapshots = teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    ownerId: team.masterId,
    ownerEmail: team.master.email,
    crmSubscriptionId: subscriptionByOwner.get(team.masterId) ?? null,
    activeGrace: graceByTeam.get(team.id) ?? null,
    brunoMembership: team.members[0] ?? null,
  }))

  if (snapshots.length !== TEAM_OWNERSHIP_TRANSFER_TARGETS.length) {
    throw new Error(`Censo divergente: esperava ${TEAM_OWNERSHIP_TRANSFER_TARGETS.length} times, encontrei ${snapshots.length}`)
  }
  return snapshots.sort((left, right) => left.teamId.localeCompare(right.teamId))
}

function writeReport(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const input = args.find((arg) => arg.startsWith("--input="))?.slice(8)
  const output = args.find((arg) => arg.startsWith("--output="))?.slice(9) ?? "/tmp/opencode/bruno-migrated-team-access-repair.json"
  const expectedChecksum = args.find((arg) => arg.startsWith("--checksum="))?.slice(11)

  if (apply && process.env[REPAIR_APPLY_ENV] !== "1") throw new Error(`--apply exige ${REPAIR_APPLY_ENV}=1`)
  if (apply && (!input || !expectedChecksum)) throw new Error("--apply exige --input e --checksum")

  const snapshots = await loadSnapshots(prisma)
  const actions = buildRepairActions(snapshots)
  const plan = {
    repairId: REPAIR_ID,
    actorProfileId: ACTOR_PROFILE_ID,
    expiry: REPAIR_EXPIRY,
    targets: TEAM_OWNERSHIP_TRANSFER_TARGETS.map((target) => ({ teamId: target.teamId, teamName: target.teamName, ownerId: target.profileId })),
    actions,
  }
  const planChecksum = checksum(plan)

  if (!apply) {
    const report = { generatedAt: new Date().toISOString(), apply: false, plan, snapshots, checksum: planChecksum }
    writeReport(output, report)
    console.info(JSON.stringify({ output, checksum: planChecksum, actionCount: actions.length, actions }, null, 2))
    return
  }

  const report = JSON.parse(readFileSync(input!, "utf8")) as { plan: typeof plan; snapshots: RepairSnapshot[]; checksum: string }
  if (report.checksum !== expectedChecksum || report.checksum !== planChecksum) throw new Error("dry-run divergente; gere um novo relatório")

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const actor = await tx.profile.findUnique({ where: { id: ACTOR_PROFILE_ID }, select: { id: true } })
    if (!actor) throw new Error("Ator de auditoria não encontrado")

    for (const action of actions) {
      if (action.kind === "create_subscription") {
        const created = await tx.backofficeUserSubscription.create({
          data: { profileId: action.ownerId, productId: CRM_PRODUCT_ID, startDate: now, endDate: new Date(REPAIR_EXPIRY) },
          select: { id: true, status: true, startDate: true, endDate: true },
        })
        await tx.subscriptionChangeLog.create({
          data: {
            profileId: action.ownerId,
            source: REPAIR_ID,
            actorProfileId: ACTOR_PROFILE_ID,
            changeType: "temporary_crm_entitlement_granted",
            after: { subscriptionId: created.id, productId: CRM_PRODUCT_ID, status: String(created.status), startDate: created.startDate.toISOString(), endDate: created.endDate?.toISOString() ?? null } as Prisma.InputJsonValue,
            metadata: { teamId: action.teamId, repairId: REPAIR_ID, expiry: REPAIR_EXPIRY, asaasMutation: false, banMutation: false },
          },
        })
      }

      if (action.kind === "expire_grace") {
        const current = await tx.billingAccessGrace.findUnique({ where: { id: action.graceId }, select: { teamId: true, expiresAt: true } })
        if (!current || current.teamId !== action.teamId) throw new Error(`Grace divergente: ${action.teamId}`)
        await tx.billingAccessGrace.update({ where: { id: action.graceId }, data: { expiresAt: new Date(REPAIR_EXPIRY) } })
        await tx.subscriptionChangeLog.create({
          data: {
            profileId: snapshots.find((snapshot) => snapshot.teamId === action.teamId)!.ownerId,
            source: REPAIR_ID,
            actorProfileId: ACTOR_PROFILE_ID,
            changeType: "temporary_billing_access_expiry_normalized",
            before: { graceId: action.graceId, expiresAt: null } as Prisma.InputJsonValue,
            after: { graceId: action.graceId, expiresAt: REPAIR_EXPIRY } as Prisma.InputJsonValue,
            metadata: { teamId: action.teamId, repairId: REPAIR_ID, asaasMutation: false, banMutation: false },
          },
        })
      }

      if (action.kind === "create_membership") {
        const created = await tx.teamMember.create({
          data: { teamId: action.teamId, profileId: BRUNO_PROFILE_ID, role: "manager", functions: ["CLOSER"], canCreateAccountUsers: true, canManageAccountTeams: true, canTransferAccountLeads: false, canViewAllTeams: false },
          select: { id: true, role: true, functions: true, canCreateAccountUsers: true, canManageAccountTeams: true, canTransferAccountLeads: true, canViewAllTeams: true },
        })
        await tx.auditLog.create({
          data: { entityType: "TEAM_MEMBER", entityId: created.id, action: "CREATE", actorProfileId: ACTOR_PROFILE_ID, before: Prisma.JsonNull, after: { teamId: action.teamId, profileId: BRUNO_PROFILE_ID, ...created }, metadata: { repairId: REPAIR_ID, reason: "restore_manager_access_after_external_ownership_transfer" } },
        })
      }

      if (action.kind === "update_membership") {
        const updated = await tx.teamMember.update({
          where: { id: action.membershipId },
          data: { role: "manager", canCreateAccountUsers: true, canManageAccountTeams: true },
          select: { teamId: true, profileId: true, role: true, functions: true, canCreateAccountUsers: true, canManageAccountTeams: true, canTransferAccountLeads: true, canViewAllTeams: true },
        })
        await tx.auditLog.create({
          data: { entityType: "TEAM_MEMBER", entityId: action.membershipId, action: "UPDATE", actorProfileId: ACTOR_PROFILE_ID, after: updated as Prisma.InputJsonValue, metadata: { repairId: REPAIR_ID, reason: "restore_manager_access_after_external_ownership_transfer" } },
        })
      }
    }
  })

  const verification = []
  for (const target of TEAM_OWNERSHIP_TRANSFER_TARGETS) {
    const membership = await prisma.teamMember.findUnique({ where: { teamId_profileId: { teamId: target.teamId, profileId: BRUNO_PROFILE_ID } }, select: { role: true, canManageAccountTeams: true, canCreateAccountUsers: true, functions: true } })
    const access = await featureAccessService.resolveAllowedSlugs({ profileId: BRUNO_PROFILE_ID, managerId: target.profileId, activeTeamId: target.teamId, teamContext: { isMaster: false, role: membership?.role ?? "manager", functions: membership?.functions ?? [], canManageAccountTeams: membership?.canManageAccountTeams ?? false, canCreateAccountUsers: membership?.canCreateAccountUsers ?? false } })
    verification.push({ teamId: target.teamId, teamName: target.teamName, membership, crm: access.slugs.includes("crm"), featureCount: access.slugs.length, slugs: access.slugs })
  }
  const failed = verification.filter((item) => !item.membership || item.membership.role !== "manager" || !item.membership.canManageAccountTeams || !item.membership.canCreateAccountUsers || !item.crm)
  const result = { generatedAt: new Date().toISOString(), apply: true, repairId: REPAIR_ID, checksum: planChecksum, actions, verification, failed }
  writeReport(output, result)
  console.info(JSON.stringify({ output, checksum: planChecksum, actionCount: actions.length, verified: failed.length === 0, failed }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

if (import.meta.main) main().catch((error) => { console.error("[repair-bruno-migrated-team-access] erro fatal:", error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
