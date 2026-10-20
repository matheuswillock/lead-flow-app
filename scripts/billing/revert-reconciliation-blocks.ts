import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import {
  applyRevertPlan,
  assertRevertApplyAuthorization,
  buildRevertPlan,
  checksumOf,
  type BlockedProfileSnapshot,
  type RevertPlan,
  type RevertTransaction,
} from "./lib/reconciliationBlockRevert"

type Db = Pick<typeof prisma, "subscriptionChangeLog" | "profile" | "backofficeBannedUser">

const BLOCK_SOURCE = "asaas_reconciliation"
const BLOCK_CHANGE_TYPE = "access_blocked_by_reconciliation"

async function loadSnapshots(db: Db): Promise<BlockedProfileSnapshot[]> {
  const blocks = await db.subscriptionChangeLog.findMany({
    where: { source: BLOCK_SOURCE, changeType: BLOCK_CHANGE_TYPE },
    orderBy: { createdAt: "desc" },
    select: { profileId: true, before: true, after: true, createdAt: true },
  })
  const latestBlock = new Map<string, (typeof blocks)[number]>()
  for (const block of blocks) if (!latestBlock.has(block.profileId)) latestBlock.set(block.profileId, block)
  const profileIds = [...latestBlock.keys()]

  const [profiles, bans, laterLogs] = await Promise.all([
    db.profile.findMany({
      where: { id: { in: profileIds } },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscription: { select: { subscriptionStatus: true } },
        userTypeAssignment: { select: { accessStartsAt: true, accessExpiresAt: true, userType: { select: { slug: true } } } },
      },
    }),
    db.backofficeBannedUser.findMany({ where: { profileId: { in: profileIds }, status: "ACTIVE", scope: "ACCOUNT" }, select: { profileId: true } }),
    db.subscriptionChangeLog.findMany({ where: { profileId: { in: profileIds } }, select: { profileId: true, changeType: true, createdAt: true } }),
  ])
  const banned = new Set(bans.map((ban) => ban.profileId))

  return profiles.map((profile) => {
    const block = latestBlock.get(profile.id)!
    const assignment = profile.userTypeAssignment
    return {
      profileId: profile.id,
      email: profile.email,
      profileStatus: profile.subscriptionStatus,
      canonicalStatus: profile.subscription?.subscriptionStatus ?? null,
      hasActiveAccountBan: banned.has(profile.id),
      reconciliationLog: { before: block.before, after: block.after },
      laterChangeTypes: laterLogs
        .filter((log) => log.profileId === profile.id && log.createdAt > block.createdAt)
        .map((log) => log.changeType),
      memberPro:
        assignment?.userType.slug === "member_pro"
          ? { accessStartsAt: assignment.accessStartsAt?.toISOString() ?? null, accessExpiresAt: assignment.accessExpiresAt?.toISOString() ?? null }
          : null,
    }
  })
}

function toTransaction(tx: Prisma.TransactionClient): RevertTransaction {
  return {
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
          source: "reconciliation_block_revert",
          changeType: input.changeType,
          before: input.before as Prisma.InputJsonValue,
          after: input.after as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      })
    },
  }
}

async function verifyMasterAccess(plan: RevertPlan) {
  const teams = await prisma.team.findMany({
    where: { masterId: { in: plan.eligible.map((target) => target.profileId) }, deletedAt: null },
    select: { id: true, masterId: true },
  })
  return Promise.all(
    plan.eligible.map(async (target) => {
      const team = teams.find((item) => item.masterId === target.profileId)
      if (!team) return { email: target.email, teamFound: false, crm: false, featureCount: 0 }
      const access = await featureAccessService.resolveAllowedSlugs({
        profileId: target.profileId,
        managerId: target.profileId,
        activeTeamId: team.id,
        teamContext: { isMaster: true, role: "manager", functions: [], canManageAccountTeams: true, canCreateAccountUsers: true },
      })
      return { email: target.email, teamFound: true, crm: access.slugs.includes("crm"), featureCount: access.slugs.length }
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
  const output = argumentValue(args, "output") ?? join(tmpdir(), "reconciliation-block-revert.json")
  const operatorProfileId = assertRevertApplyAuthorization({ apply, env: process.env, reportPath: input, checksum: expectedChecksum })

  const plan = buildRevertPlan(await loadSnapshots(prisma), new Date())
  const planChecksum = checksumOf(plan)

  if (!apply) {
    writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: false, plan, checksum: planChecksum }, null, 2), { encoding: "utf8", mode: 0o600 })
    console.info(JSON.stringify({ output, checksum: planChecksum, eligible: plan.eligible, skipped: plan.skipped }, null, 2))
    return
  }

  const reviewed = JSON.parse(readFileSync(input!, "utf8")) as { checksum: string; plan: unknown }
  if (reviewed.checksum !== expectedChecksum || checksumOf(reviewed.plan) !== expectedChecksum || planChecksum !== expectedChecksum) {
    throw new Error("Dry-run inválido ou divergente do estado atual; gere um novo relatório")
  }

  const reverted = await prisma.$transaction(async (tx) => {
    const operator = await tx.profile.findUnique({ where: { id: operatorProfileId! }, select: { id: true } })
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    const fresh = buildRevertPlan(await loadSnapshots(tx as unknown as Db), new Date())
    if (checksumOf(fresh) !== expectedChecksum) throw new Error("O estado mudou desde o dry-run")
    return applyRevertPlan(toTransaction(tx), fresh, operatorProfileId!)
  })

  const access = await verifyMasterAccess(plan)
  const failed = access.filter((item) => !item.teamFound || !item.crm)
  writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: true, plan, checksum: planChecksum, reverted, access, failed }, null, 2), { encoding: "utf8", mode: 0o600 })
  console.info(JSON.stringify({ output, checksum: planChecksum, reverted, verified: failed.length === 0, access }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("[revert-reconciliation-blocks] erro fatal:", error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
