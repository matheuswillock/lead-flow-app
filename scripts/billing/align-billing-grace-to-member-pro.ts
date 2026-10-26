import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { featureAccessService } from "@/app/api/services/featureAccess/FeatureAccessService"
import {
  applyGraceAlignmentPlan,
  assertGraceAlignApplyAuthorization,
  buildGraceAlignmentPlan,
  checksumOf,
  type GraceAlignmentCandidate,
  type GraceAlignmentPlan,
  type GraceAlignmentTransaction,
} from "./lib/graceExpiryAlignment"

type Db = Pick<typeof prisma, "billingAccessGrace" | "backofficeBannedUser">

function argumentValue(args: readonly string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

// Seleciona graces ativas e mais curtas que o Member PRO do master, onde o Member PRO
// termina exatamente em `memberProExpiresAt` (o lote estendido para 27/11).
async function loadCandidates(db: Db, memberProExpiresAt: Date): Promise<GraceAlignmentCandidate[]> {
  const graces = await db.billingAccessGrace.findMany({
    where: {
      isActive: true,
      expiresAt: { not: null, lt: memberProExpiresAt },
      team: {
        deletedAt: null,
        master: { deletedAt: null, userTypeAssignment: { accessExpiresAt: memberProExpiresAt, userType: { slug: "member_pro" } } },
      },
    },
    select: { id: true, teamId: true, reason: true, expiresAt: true, team: { select: { masterId: true, master: { select: { email: true } } } } },
  })
  const bans = await db.backofficeBannedUser.findMany({
    where: { profileId: { in: graces.map((grace) => grace.team.masterId) }, status: "ACTIVE", scope: "ACCOUNT" },
    select: { profileId: true },
  })
  const banned = new Set(bans.map((ban) => ban.profileId))
  return graces.map((grace) => ({
    graceId: grace.id,
    teamId: grace.teamId,
    profileId: grace.team.masterId,
    email: grace.team.master.email,
    reason: grace.reason,
    graceExpiresAt: grace.expiresAt?.toISOString() ?? null,
    memberProExpiresAt: memberProExpiresAt.toISOString(),
    hasActiveAccountBan: banned.has(grace.team.masterId),
  }))
}

function toTransaction(tx: Prisma.TransactionClient): GraceAlignmentTransaction {
  return {
    async updateGraceExpiry({ graceId, teamId, from, to }) {
      const result = await tx.billingAccessGrace.updateMany({ where: { id: graceId, teamId, isActive: true, expiresAt: from }, data: { expiresAt: to } })
      return result.count
    },
    async writeChangeLog(input) {
      await tx.subscriptionChangeLog.create({
        data: {
          profileId: input.profileId,
          actorProfileId: input.actorProfileId,
          source: "billing_grace_member_pro_alignment",
          changeType: input.changeType,
          before: input.before as Prisma.InputJsonValue,
          after: input.after as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      })
    },
  }
}

async function verifyAccess(plan: GraceAlignmentPlan) {
  return Promise.all(
    plan.items.map(async (item) => {
      const access = await featureAccessService.resolveAllowedSlugs({
        profileId: item.profileId,
        managerId: item.profileId,
        activeTeamId: item.teamId,
        teamContext: { isMaster: true, role: "manager", functions: [], canManageAccountTeams: true, canCreateAccountUsers: true },
      })
      const grace = await prisma.billingAccessGrace.findUnique({ where: { id: item.graceId }, select: { expiresAt: true } })
      return { email: item.email, graceAligned: grace?.expiresAt?.toISOString() === item.to, crm: access.slugs.includes("crm") }
    }),
  )
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const input = argumentValue(args, "input")
  const expectedChecksum = argumentValue(args, "checksum")
  const output = argumentValue(args, "output") ?? join(tmpdir(), "align-billing-grace.json")
  const memberProExpiresAt = new Date(argumentValue(args, "member-pro-expires-at") ?? "")
  if (Number.isNaN(memberProExpiresAt.getTime())) throw new Error("Informe --member-pro-expires-at em ISO-8601 UTC")
  const operatorProfileId = assertGraceAlignApplyAuthorization({ apply, env: process.env, reportPath: input, checksum: expectedChecksum })

  const plan = buildGraceAlignmentPlan(await loadCandidates(prisma, memberProExpiresAt))
  const planChecksum = checksumOf(plan)

  if (!apply) {
    writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: false, plan, checksum: planChecksum }, null, 2), { encoding: "utf8", mode: 0o600 })
    console.info(JSON.stringify({ output, checksum: planChecksum, items: plan.items.map((item) => ({ email: item.email, from: item.from, to: item.to })), skipped: plan.skipped }, null, 2))
    return
  }

  const reviewed = JSON.parse(readFileSync(input!, "utf8")) as { checksum: string; plan: unknown }
  if (reviewed.checksum !== expectedChecksum || checksumOf(reviewed.plan) !== expectedChecksum || planChecksum !== expectedChecksum) {
    throw new Error("Dry-run inválido ou divergente do estado atual; gere um novo relatório")
  }

  const changed = await prisma.$transaction(async (tx) => {
    const operator = await tx.profile.findUnique({ where: { id: operatorProfileId! }, select: { id: true } })
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    const fresh = buildGraceAlignmentPlan(await loadCandidates(tx as unknown as Db, memberProExpiresAt))
    if (checksumOf(fresh) !== expectedChecksum) throw new Error("O estado mudou desde o dry-run")
    return applyGraceAlignmentPlan(toTransaction(tx), fresh, operatorProfileId!)
  })

  const access = await verifyAccess(plan)
  const failed = access.filter((item) => !item.graceAligned || !item.crm)
  writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: true, plan, checksum: planChecksum, changed, access, failed }, null, 2), { encoding: "utf8", mode: 0o600 })
  console.info(JSON.stringify({ output, checksum: planChecksum, changed, verified: failed.length === 0 }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("[align-billing-grace-to-member-pro] erro fatal:", error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
