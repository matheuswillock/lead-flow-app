import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  applyExpiredExtensionPlan,
  assertExpiryApplyAuthorization,
  buildExpiredExtensionPlan,
  checksumOf,
  parseRequestedExpiry,
  type ExpiredMemberProCandidate,
  type MemberProExpiryTransaction,
} from "./lib/memberProExpiryOverride"

type Db = Pick<typeof prisma, "profileUserTypeAssignment" | "backofficeBannedUser">

function argumentValue(args: readonly string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

async function loadExpiredCandidates(db: Db, now: Date): Promise<ExpiredMemberProCandidate[]> {
  const assignments = await db.profileUserTypeAssignment.findMany({
    where: { userType: { slug: "member_pro" }, accessExpiresAt: { lte: now } },
    select: {
      accessStartsAt: true,
      accessExpiresAt: true,
      profile: { select: { id: true, email: true, deletedAt: true } },
    },
  })
  const bans = await db.backofficeBannedUser.findMany({
    where: { profileId: { in: assignments.map((item) => item.profile.id) }, status: "ACTIVE", scope: "ACCOUNT" },
    select: { profileId: true },
  })
  const banned = new Set(bans.map((ban) => ban.profileId))
  return assignments.map((item) => ({
    profileId: item.profile.id,
    email: item.profile.email,
    deletedAt: item.profile.deletedAt?.toISOString() ?? null,
    hasActiveAccountBan: banned.has(item.profile.id),
    assignment: {
      slug: "member_pro",
      accessStartsAt: item.accessStartsAt?.toISOString() ?? null,
      accessExpiresAt: item.accessExpiresAt?.toISOString() ?? null,
    },
  }))
}

function toTransaction(tx: Prisma.TransactionClient): MemberProExpiryTransaction {
  return {
    async updateMemberProExpiry({ profileId, from, to }) {
      const result = await tx.profileUserTypeAssignment.updateMany({
        where: { profileId, accessExpiresAt: from, userType: { slug: "member_pro" } },
        data: { accessExpiresAt: to },
      })
      return result.count
    },
    async writeChangeLog(input) {
      await tx.subscriptionChangeLog.create({
        data: {
          profileId: input.profileId,
          actorProfileId: input.actorProfileId,
          source: "member_pro_expired_extension",
          changeType: input.changeType,
          before: input.before as Prisma.InputJsonValue,
          after: input.after as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      })
    },
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const input = argumentValue(args, "input")
  const expectedChecksum = argumentValue(args, "checksum")
  const output = argumentValue(args, "output") ?? join(tmpdir(), "extend-expired-member-pro.json")
  const reason = argumentValue(args, "reason") ?? "extensão em lote dos Member PRO vencidos"
  const operatorProfileId = assertExpiryApplyAuthorization({ apply, env: process.env, reportPath: input, checksum: expectedChecksum })
  const expiresAt = parseRequestedExpiry(argumentValue(args, "expires-at"), new Date())

  const buildPlan = async (db: Db) => {
    const now = new Date()
    return buildExpiredExtensionPlan(await loadExpiredCandidates(db, now), { expiresAt, reason }, now)
  }
  const plan = await buildPlan(prisma)
  const planChecksum = checksumOf(plan)

  if (!apply) {
    writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: false, plan, checksum: planChecksum }, null, 2), { encoding: "utf8", mode: 0o600 })
    console.info(JSON.stringify({ output, checksum: planChecksum, extend: plan.extend.map((item) => ({ email: item.email, from: item.from, to: item.to })), skipped: plan.skipped }, null, 2))
    return
  }

  const reviewed = JSON.parse(readFileSync(input!, "utf8")) as { checksum: string; plan: unknown }
  if (reviewed.checksum !== expectedChecksum || checksumOf(reviewed.plan) !== expectedChecksum || planChecksum !== expectedChecksum) {
    throw new Error("Dry-run inválido ou divergente do estado atual; gere um novo relatório")
  }

  const changed = await prisma.$transaction(async (tx) => {
    const operator = await tx.profile.findUnique({ where: { id: operatorProfileId! }, select: { id: true } })
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    const fresh = await buildPlan(tx as unknown as Db)
    if (checksumOf(fresh) !== expectedChecksum) throw new Error("O estado mudou desde o dry-run")
    return applyExpiredExtensionPlan(toTransaction(tx), fresh, operatorProfileId!)
  })

  const after = await prisma.profileUserTypeAssignment.findMany({
    where: { profileId: { in: plan.extend.map((item) => item.profileId) } },
    select: { profileId: true, accessExpiresAt: true },
  })
  const failed = plan.extend.filter((item) => after.find((row) => row.profileId === item.profileId)?.accessExpiresAt?.toISOString() !== item.to)
  writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: true, plan, checksum: planChecksum, changed, failed }, null, 2), { encoding: "utf8", mode: 0o600 })
  console.info(JSON.stringify({ output, checksum: planChecksum, changed, verified: failed.length === 0 }, null, 2))
  if (failed.length > 0) process.exitCode = 1
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("[extend-expired-member-pro] erro fatal:", error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
