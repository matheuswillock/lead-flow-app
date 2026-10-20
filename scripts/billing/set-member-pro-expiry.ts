import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  applyMemberProExpiryPlan,
  assertExpiryApplyAuthorization,
  buildMemberProExpiryPlan,
  checksumOf,
  type MemberProExpiryRequest,
  type MemberProExpirySnapshot,
  type MemberProExpiryTransaction,
} from "./lib/memberProExpiryOverride"

type Db = Pick<typeof prisma, "profile" | "backofficeBannedUser">

function argumentValue(args: readonly string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
}

async function loadSnapshot(db: Db, profileId: string): Promise<MemberProExpirySnapshot> {
  const [profile, ban] = await Promise.all([
    db.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        email: true,
        deletedAt: true,
        userTypeAssignment: {
          select: { accessStartsAt: true, accessExpiresAt: true, userType: { select: { slug: true } } },
        },
      },
    }),
    db.backofficeBannedUser.findFirst({ where: { profileId, status: "ACTIVE", scope: "ACCOUNT" }, select: { id: true } }),
  ])
  if (!profile) throw new Error("Perfil não encontrado")
  const assignment = profile.userTypeAssignment
  return {
    profileId: profile.id,
    email: profile.email,
    deletedAt: profile.deletedAt?.toISOString() ?? null,
    hasActiveAccountBan: ban !== null,
    assignment: assignment
      ? {
          slug: assignment.userType.slug,
          accessStartsAt: assignment.accessStartsAt?.toISOString() ?? null,
          accessExpiresAt: assignment.accessExpiresAt?.toISOString() ?? null,
        }
      : null,
  }
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
          source: "member_pro_expiry_override",
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
  const output = argumentValue(args, "output") ?? join(tmpdir(), "member-pro-expiry-override.json")
  const request: MemberProExpiryRequest = {
    profileId: argumentValue(args, "profile-id") ?? "",
    email: argumentValue(args, "email") ?? "",
    expiresAt: argumentValue(args, "expires-at") ?? "",
    reason: argumentValue(args, "reason") ?? "ajuste operacional solicitado",
  }
  const operatorProfileId = assertExpiryApplyAuthorization({ apply, env: process.env, reportPath: input, checksum: expectedChecksum })

  const plan = buildMemberProExpiryPlan(await loadSnapshot(prisma, request.profileId), request, new Date())
  const planChecksum = checksumOf(plan)

  if (!apply) {
    writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: false, plan, checksum: planChecksum }, null, 2), { encoding: "utf8", mode: 0o600 })
    console.info(JSON.stringify({ output, checksum: planChecksum, plan }, null, 2))
    return
  }

  const reviewed = JSON.parse(readFileSync(input!, "utf8")) as { checksum: string; plan: unknown }
  if (reviewed.checksum !== expectedChecksum || checksumOf(reviewed.plan) !== expectedChecksum || planChecksum !== expectedChecksum) {
    throw new Error("Dry-run inválido ou divergente do estado atual; gere um novo relatório")
  }

  const changed = await prisma.$transaction(async (tx) => {
    const operator = await tx.profile.findUnique({ where: { id: operatorProfileId! }, select: { id: true } })
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    const fresh = buildMemberProExpiryPlan(await loadSnapshot(tx as unknown as Db, request.profileId), request, new Date())
    if (checksumOf(fresh) !== expectedChecksum) throw new Error("O estado mudou desde o dry-run")
    return applyMemberProExpiryPlan(toTransaction(tx), fresh, operatorProfileId!)
  })

  const after = await loadSnapshot(prisma, request.profileId)
  const verified = after.assignment?.accessExpiresAt === plan.to
  writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), apply: true, plan, checksum: planChecksum, changed, after }, null, 2), { encoding: "utf8", mode: 0o600 })
  console.info(JSON.stringify({ output, checksum: planChecksum, changed, verified, accessExpiresAt: after.assignment?.accessExpiresAt }, null, 2))
  if (!verified) process.exitCode = 1
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("[set-member-pro-expiry] erro fatal:", error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
