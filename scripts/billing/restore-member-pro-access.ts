import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { findActiveAccountBannedMasterIds } from "@/lib/account/isAccountMasterBanned"
import { isActiveMemberProAssignment } from "@/app/api/shared/billing/memberProBillingRules"
import { resolveMemberProAccessWindowRepair } from "./lib/memberProAccessWindowRepair"

type Arguments = { apply: boolean; input?: string; output?: string; checksum?: string; profileId?: string }
type RepairTarget = {
  profileId: string
  email: string | null
  sourceStart: string
  currentAccessStartsAt: string | null
  currentAccessExpiresAt: string | null
  targetAccessStartsAt: string
  targetAccessExpiresAt: string
  preservesLongerWindow: boolean
}
type ExpiredTarget = {
  profileId: string
  email: string | null
  accessStartsAt: string | null
  accessExpiresAt: string | null
  profileStatus: string | null
  profileSubscriptionStatus: string | null
}
type RepairReport = { generatedAt: string; apply: boolean; targets: RepairTarget[]; expiredTargets: ExpiredTarget[]; checksum: string }

function parseArguments(argv: string[]): Arguments {
  const value = (name: string) => argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)
  return { apply: argv.includes("--apply"), input: value("input"), output: value("output"), checksum: value("checksum"), profileId: value("profile-id") }
}

function calculateChecksum(targets: readonly RepairTarget[], expiredTargets: readonly ExpiredTarget[]): string {
  return createHash("sha256").update(JSON.stringify({ targets, expiredTargets })).digest("hex")
}

function assertApplyAuthorization(args: Arguments): void {
  if (!args.apply) return
  if (process.env.MEMBER_PRO_ACCESS_WINDOW_APPLY !== "1") throw new Error("Recusado: --apply exige MEMBER_PRO_ACCESS_WINDOW_APPLY=1")
  if (!args.input || !args.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
}

function readDryRunReport(path: string, checksum: string): RepairReport {
  const report = JSON.parse(readFileSync(path, "utf-8")) as RepairReport
  const expiredTargets = report.expiredTargets ?? []
  if (!Array.isArray(report.targets) || !Array.isArray(expiredTargets) || report.checksum !== checksum || calculateChecksum(report.targets, expiredTargets) !== checksum) throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  report.expiredTargets = expiredTargets
  return report
}

async function findRepairPlan(profileId?: string): Promise<{ targets: RepairTarget[]; expiredTargets: ExpiredTarget[] }> {
  const now = new Date()
  const assignments = await prisma.profileUserTypeAssignment.findMany({
    where: { ...(profileId ? { profileId } : {}), userType: { slug: "member_pro" } },
    select: {
      profileId: true,
      accessStartsAt: true,
      accessExpiresAt: true,
      userType: { select: { slug: true } },
      profile: { select: { email: true, createdAt: true, hasPermanentSubscription: true, subscriptionStatus: true, subscription: { select: { subscriptionStartDate: true, subscriptionStatus: true } } } },
    },
  })
  const bannedIds = await findActiveAccountBannedMasterIds(assignments.map((row) => row.profileId))
  const eligible = assignments.filter((row) => !bannedIds.has(row.profileId) && !row.profile.hasPermanentSubscription)
  const expiredTargets = eligible
    .filter((row) => row.accessExpiresAt === null || row.accessExpiresAt.getTime() <= now.getTime())
    .map((row) => ({
      profileId: row.profileId,
      email: row.profile.email,
      accessStartsAt: row.accessStartsAt?.toISOString() ?? null,
      accessExpiresAt: row.accessExpiresAt?.toISOString() ?? null,
      profileStatus: row.profile.subscriptionStatus,
      profileSubscriptionStatus: row.profile.subscription?.subscriptionStatus ?? null,
    }))
  const targets = eligible
    .filter((row) => isActiveMemberProAssignment({ slug: row.userType.slug, accessStartsAt: row.accessStartsAt, accessExpiresAt: row.accessExpiresAt }, now))
    .map((row) => {
      const sourceStart = row.profile.subscription?.subscriptionStartDate ?? row.profile.createdAt
      const repair = resolveMemberProAccessWindowRepair({ sourceStart, currentAccessStartsAt: row.accessStartsAt, currentAccessExpiresAt: row.accessExpiresAt })
      return {
        profileId: row.profileId,
        email: row.profile.email,
        sourceStart: sourceStart.toISOString(),
        currentAccessStartsAt: row.accessStartsAt?.toISOString() ?? null,
        currentAccessExpiresAt: row.accessExpiresAt?.toISOString() ?? null,
        targetAccessStartsAt: repair.accessStartsAt.toISOString(),
        targetAccessExpiresAt: repair.accessExpiresAt.toISOString(),
        preservesLongerWindow: repair.preservesLongerWindow,
        changed: repair.changed,
      }
    })
    .filter((target) => target.changed)
    .map(({ changed: _changed, ...target }) => target)
    .sort((left, right) => left.profileId.localeCompare(right.profileId))
  return { targets, expiredTargets }
}

async function applyRepair(targets: readonly RepairTarget[], expiredTargets: readonly ExpiredTarget[]): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const target of targets) {
      const current = await transaction.profile.findUnique({
        where: { id: target.profileId },
        select: {
          id: true,
          email: true,
          createdAt: true,
          hasPermanentSubscription: true,
          subscription: { select: { subscriptionStartDate: true } },
          userTypeAssignment: { select: { accessStartsAt: true, accessExpiresAt: true, userType: { select: { slug: true } } } },
        },
      })
      if (!current || current.email !== target.email || current.hasPermanentSubscription) throw new Error(`Perfil ${target.profileId} mudou desde o dry-run`)
      const activeBan = await transaction.backofficeBannedUser.findFirst({ where: { profileId: target.profileId, status: "ACTIVE", scope: "ACCOUNT" }, select: { id: true } })
      if (activeBan) throw new Error(`Perfil ${target.profileId} está banido; reparo abortado`)
      const assignment = current.userTypeAssignment
      const sourceStart = current.subscription?.subscriptionStartDate ?? current.createdAt
      const repair = resolveMemberProAccessWindowRepair({ sourceStart, currentAccessStartsAt: assignment?.accessStartsAt ?? null, currentAccessExpiresAt: assignment?.accessExpiresAt ?? null })
      if (!assignment || assignment.userType.slug !== "member_pro" || !repair.changed || repair.accessStartsAt.toISOString() !== target.targetAccessStartsAt || repair.accessExpiresAt.toISOString() !== target.targetAccessExpiresAt) throw new Error(`Perfil ${target.profileId} não corresponde ao dry-run`)
      await transaction.profileUserTypeAssignment.update({ where: { profileId: target.profileId }, data: { accessStartsAt: repair.accessStartsAt, accessExpiresAt: repair.accessExpiresAt } })
      await transaction.subscriptionChangeLog.create({
        data: {
          profileId: target.profileId,
          source: "member_pro_access_window_repair",
          changeType: "member_pro_access_window_normalized",
          before: { accessStartsAt: assignment.accessStartsAt?.toISOString() ?? null, accessExpiresAt: assignment.accessExpiresAt?.toISOString() ?? null },
          after: { accessStartsAt: repair.accessStartsAt.toISOString(), accessExpiresAt: repair.accessExpiresAt.toISOString() },
          metadata: { reason: "Member PRO fixo em 100 dias; nenhuma alteração de status ou Asaas" },
        },
      })
    }
    for (const target of expiredTargets) {
      const current = await transaction.profile.findUnique({
        where: { id: target.profileId },
        select: {
          email: true,
          subscriptionStatus: true,
          hasPermanentSubscription: true,
          hasUnlimitedUsers: true,
          userTypeAssignment: { select: { accessStartsAt: true, accessExpiresAt: true, userType: { select: { slug: true } } } },
          subscription: { select: { subscriptionStatus: true } },
        },
      })
      if (!current || current.email !== target.email || current.hasPermanentSubscription) throw new Error(`Perfil ${target.profileId} mudou desde o dry-run`)
      const activeBan = await transaction.backofficeBannedUser.findFirst({ where: { profileId: target.profileId, status: "ACTIVE", scope: "ACCOUNT" }, select: { id: true } })
      if (activeBan) throw new Error(`Perfil ${target.profileId} está banido; reparo abortado`)
      if (current.userTypeAssignment?.userType.slug !== "member_pro" ||
          (current.userTypeAssignment.accessStartsAt?.toISOString() ?? null) !== target.accessStartsAt ||
          (current.userTypeAssignment.accessExpiresAt?.toISOString() ?? null) !== target.accessExpiresAt) {
        throw new Error(`Perfil ${target.profileId} não corresponde ao dry-run de expiração`)
      }
      const now = new Date()
      const hasAnnualGrant = await transaction.backofficeAdhesion.findFirst({
        where: { createdProfileId: target.profileId, status: "paid", cycle: "annual" },
        select: { id: true },
      })
      const yearlySubscription = await transaction.profileSubscription.findFirst({
        where: {
          profileId: target.profileId,
          subscriptionCycle: "YEARLY",
          OR: [{ subscriptionStatus: null }, { subscriptionStatus: "active" }],
          AND: [
            { OR: [{ subscriptionStartDate: null }, { subscriptionStartDate: { lte: now } }] },
            { OR: [{ subscriptionEndDate: null }, { subscriptionEndDate: { gte: now } }] },
          ],
        },
        select: { id: true },
      })
      const preserveUnlimitedUsers = Boolean(hasAnnualGrant || yearlySubscription)
      const changed = current.subscriptionStatus !== "past_due" || current.subscription?.subscriptionStatus !== "past_due" || current.hasUnlimitedUsers !== preserveUnlimitedUsers
      await transaction.profile.update({ where: { id: target.profileId }, data: { subscriptionStatus: "past_due", hasUnlimitedUsers: preserveUnlimitedUsers } })
      if (current.subscription) {
        await transaction.profileSubscription.update({ where: { profileId: target.profileId }, data: { subscriptionStatus: "past_due" } })
      }
      if (changed) {
        await transaction.subscriptionChangeLog.create({
          data: {
            profileId: target.profileId,
            source: "member_pro_access_window_repair",
            changeType: "member_pro_expired",
            eventType: "overdue",
            before: { profileStatus: current.subscriptionStatus, profileSubscriptionStatus: current.subscription?.subscriptionStatus ?? null, hasUnlimitedUsers: current.hasUnlimitedUsers },
            after: { profileStatus: "past_due", profileSubscriptionStatus: "past_due", hasUnlimitedUsers: preserveUnlimitedUsers },
            metadata: { asaasMutation: false },
          },
        })
      }
    }
  })
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  const report = args.apply ? readDryRunReport(args.input!, args.checksum!) : { generatedAt: new Date().toISOString(), apply: false, ...(await findRepairPlan(args.profileId)), checksum: "" }
  const resolvedReport = report.checksum ? report : { ...report, checksum: calculateChecksum(report.targets, report.expiredTargets) }
  if (args.apply) await applyRepair(resolvedReport.targets, resolvedReport.expiredTargets)
  const output = { ...resolvedReport, apply: args.apply, outcome: args.apply ? "applied" : "planned" }
  if (args.output) writeFileSync(args.output, JSON.stringify(output, null, 2), "utf-8")
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[restore-member-pro-access] erro fatal:", error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
