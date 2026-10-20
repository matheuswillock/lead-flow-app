import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import {
  ERICK_TARGET,
  applyErickAccessPlan,
  assertApplyAuthorization,
  buildErickAccessPlan,
  checksumOf,
  type AccessRepairTransaction,
  type ErickAccessSnapshot,
} from "./lib/erickSerafimTeamAccess"

type Db = Pick<
  typeof prisma,
  "profile" | "team" | "backofficeBannedUser" | "subscriptionChangeLog"
>

const DEFAULT_OUTPUT = join(tmpdir(), "erick-serafim-team-access-repair.json")

async function loadSnapshot(db: Db): Promise<ErickAccessSnapshot> {
  const [profile, team, ban, reconciliationLog] = await Promise.all([
    db.profile.findUnique({
      where: { id: ERICK_TARGET.profileId },
      select: {
        id: true,
        email: true,
        isMaster: true,
        deletedAt: true,
        subscriptionStatus: true,
        subscription: { select: { subscriptionStatus: true } },
        userTypeAssignment: {
          select: { accessStartsAt: true, accessExpiresAt: true, userType: { select: { slug: true } } },
        },
      },
    }),
    db.team.findUnique({
      where: { id: ERICK_TARGET.teamId },
      select: { id: true, name: true, masterId: true, deletedAt: true },
    }),
    db.backofficeBannedUser.findFirst({
      where: { profileId: ERICK_TARGET.profileId, status: "ACTIVE", scope: "ACCOUNT" },
      select: { id: true },
    }),
    db.subscriptionChangeLog.findFirst({
      where: { profileId: ERICK_TARGET.profileId, source: "asaas_reconciliation", changeType: "access_blocked_by_reconciliation" },
      orderBy: { createdAt: "desc" },
      select: { before: true, after: true, metadata: true },
    }),
  ])
  if (!profile) throw new Error("Master não encontrado")

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      isMaster: profile.isMaster,
      deletedAt: profile.deletedAt?.toISOString() ?? null,
      subscriptionStatus: profile.subscriptionStatus,
    },
    canonicalSubscriptionStatus: profile.subscription?.subscriptionStatus ?? null,
    assignment: profile.userTypeAssignment
      ? {
          slug: profile.userTypeAssignment.userType.slug,
          accessStartsAt: profile.userTypeAssignment.accessStartsAt?.toISOString() ?? null,
          accessExpiresAt: profile.userTypeAssignment.accessExpiresAt?.toISOString() ?? null,
        }
      : null,
    team: team ? { ...team, deletedAt: team.deletedAt?.toISOString() ?? null } : null,
    hasActiveAccountBan: ban !== null,
    reconciliationLog: reconciliationLog ?? null,
  }
}

function toTransaction(tx: Prisma.TransactionClient): AccessRepairTransaction {
  return {
    async updateMemberProExpiry({ profileId, from, to }) {
      const result = await tx.profileUserTypeAssignment.updateMany({
        where: { profileId, accessExpiresAt: from, userType: { slug: "member_pro" } },
        data: { accessExpiresAt: to },
      })
      return result.count
    },
    async restoreSubscriptionStatus({ profileId }) {
      const profile = await tx.profile.updateMany({ where: { id: profileId, subscriptionStatus: "suspended" }, data: { subscriptionStatus: "active" } })
      const canonical = await tx.profileSubscription.updateMany({ where: { profileId, subscriptionStatus: "suspended" }, data: { subscriptionStatus: "active" } })
      return { profile: profile.count, canonical: canonical.count }
    },
    async writeChangeLog(input) {
      await tx.subscriptionChangeLog.create({
        data: {
          profileId: input.profileId,
          actorProfileId: input.actorProfileId,
          source: "erick_serafim_team_access_repair",
          changeType: input.changeType,
          before: input.before as Prisma.InputJsonValue,
          after: input.after as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      })
    },
  }
}

async function resolveTeamAccess() {
  const members = await prisma.teamMember.findMany({
    where: { teamId: ERICK_TARGET.teamId },
    select: {
      profileId: true,
      role: true,
      functions: true,
      canCreateAccountUsers: true,
      canManageAccountTeams: true,
      profile: { select: { email: true } },
    },
  })
  return Promise.all(
    members.map(async (member) => {
      const isMaster = member.profileId === ERICK_TARGET.profileId
      const access = await featureAccessService.resolveAllowedSlugs({
        profileId: member.profileId,
        managerId: ERICK_TARGET.profileId,
        activeTeamId: ERICK_TARGET.teamId,
        teamContext: {
          isMaster,
          role: member.role,
          functions: member.functions,
          canManageAccountTeams: member.canManageAccountTeams,
          canCreateAccountUsers: member.canCreateAccountUsers,
        },
      })
      return { email: member.profile.email, role: member.role, crm: access.slugs.includes("crm"), featureCount: access.slugs.length, slugs: access.slugs }
    }),
  )
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const input = argumentValue(args, "input")
  const expectedChecksum = argumentValue(args, "checksum")
  const output = argumentValue(args, "output") ?? DEFAULT_OUTPUT
  const operatorProfileId = assertApplyAuthorization({ apply, env: process.env, reportPath: input, checksum: expectedChecksum })

  const plan = buildErickAccessPlan(await loadSnapshot(prisma))
  const planChecksum = checksumOf(plan)

  if (!apply) {
    const report = { generatedAt: new Date().toISOString(), apply: false, plan, checksum: planChecksum, accessBefore: await resolveTeamAccess() }
    writeFileSync(output, JSON.stringify(report, null, 2), { encoding: "utf8", mode: 0o600 })
    console.info(JSON.stringify({ output, checksum: planChecksum, actions: plan.actions, accessBefore: report.accessBefore.map(({ slugs: _slugs, ...row }) => row) }, null, 2))
    return
  }

  const reviewed = JSON.parse(readFileSync(input!, "utf8")) as { checksum: string; plan: unknown }
  if (reviewed.checksum !== expectedChecksum || checksumOf(reviewed.plan) !== expectedChecksum || planChecksum !== expectedChecksum) {
    throw new Error("Dry-run inválido ou divergente do estado atual; gere um novo relatório")
  }

  await prisma.$transaction(async (tx) => {
    const operator = await tx.profile.findUnique({ where: { id: operatorProfileId! }, select: { id: true } })
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    const fresh = buildErickAccessPlan(await loadSnapshot(tx as unknown as Db))
    if (checksumOf(fresh) !== expectedChecksum) throw new Error("O estado mudou desde o dry-run")
    await applyErickAccessPlan(toTransaction(tx), fresh, operatorProfileId!)
  })

  const accessAfter = await resolveTeamAccess()
  const failed = accessAfter.filter((member) => !member.crm)
  writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: true, plan, checksum: planChecksum, accessAfter, failed }, null, 2), { encoding: "utf8", mode: 0o600 })
  console.info(JSON.stringify({ output, checksum: planChecksum, verified: failed.length === 0, failed }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("[repair-erick-serafim-team-access] erro fatal:", error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
