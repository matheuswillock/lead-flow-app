import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { resolveMemberProAccessWindow } from "@/app/api/shared/billing/memberProBillingRules"

const APPLY_ENV = "MEMBER_PRO_COMMERCIAL_EXCEPTION_APPLY"
const CHANGE_SOURCE = "commercial_member_pro_exception"
const CHANGE_TYPE = "member_pro_commercial_exception"

export const COMMERCIAL_MEMBER_PRO_TARGETS = [
  {
    profileId: "9fefaf1f-9c5c-44f6-bf17-bbad7496b484",
    teamId: "5c41dc4f-1d32-4d92-859a-69fd7311bfa0",
    teamName: "Calli Seguros",
    email: "douglascalligari@gmail.com",
    accessStartsAt: "2026-08-13T17:57:00.783Z",
    accessExpiresAt: "2026-11-21T17:57:00.783Z",
  },
  {
    profileId: "af5db545-9dd5-4ba2-9c57-6bd05126b4a7",
    teamId: "2fa813cf-59d7-4771-bba2-a94cb225f2b5",
    teamName: "Avantar Corretora de Seguros",
    email: "biancaarias@avantar.com.br",
    accessStartsAt: "2026-09-04T13:20:07.088Z",
    accessExpiresAt: "2026-12-13T13:20:07.088Z",
  },
] as const

type CommercialTarget = (typeof COMMERCIAL_MEMBER_PRO_TARGETS)[number]
type Action = "already-correct" | "create-member-pro" | "update-member-pro"
type Arguments = { apply: boolean; dryRun: boolean; input?: string; output?: string; checksum?: string }

export type TargetSnapshot = {
  profileId: string
  email: string
  isMaster: boolean
  deletedAt: string | null
  hasPermanentSubscription: boolean
  hasUnlimitedUsers: boolean
  subscriptionStartDate: string | null
  profileSubscriptionStartDate: string | null
  asaasCustomerId: string | null
  asaasCustomerAccount: string
  asaasSubscriptionId: string | null
  asaasSubscriptionAccount: string
  assignment: {
    userTypeSlug: string
    accessStartsAt: string | null
    accessExpiresAt: string | null
    assignedByProfileId: string | null
  } | null
  team: { id: string; name: string; masterId: string; deletedAt: string | null } | null
  activeBan: { id: string; reason: string | null } | null
}

export type CommercialPlanItem = {
  target: CommercialTarget
  action: Action
  current: TargetSnapshot
  after: {
    userTypeSlug: "member_pro"
    accessStartsAt: string
    accessExpiresAt: string
    hasUnlimitedUsers: true
  }
  asaasMutation: false
}

export type CommercialRepairReport = {
  generatedAt: string
  apply: boolean
  plan: CommercialPlanItem[]
  checksum: string
}

type TargetSnapshotWithExpectedWindow = TargetSnapshot & {
  expectedAccessStartsAt: string
  expectedAccessExpiresAt: string
}

function parseArguments(argv: readonly string[]): Arguments {
  const value = (name: string) =>
    argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3)

  const apply = argv.includes("--apply")
  const dryRun = argv.includes("--dry-run") || !apply
  if (apply && argv.includes("--dry-run")) {
    throw new Error("Use apenas --dry-run ou --apply")
  }
  return { apply, dryRun, input: value("input"), output: value("output"), checksum: value("checksum") }
}

export function calculateCommercialRepairChecksum(plan: readonly CommercialPlanItem[]): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

function assertApprovedCensus(plan: readonly CommercialPlanItem[]): void {
  if (plan.length !== COMMERCIAL_MEMBER_PRO_TARGETS.length) {
    throw new Error("Dry-run não corresponde ao censo comercial aprovado")
  }

  const approvedProfileIds = new Set(COMMERCIAL_MEMBER_PRO_TARGETS.map((target) => target.profileId))
  const seenProfileIds = new Set<string>()

  for (const item of plan) {
    if (seenProfileIds.has(item.target.profileId)) {
      throw new Error(`Dry-run contém perfil duplicado: ${item.target.profileId}`)
    }
    seenProfileIds.add(item.target.profileId)

    const approved = COMMERCIAL_MEMBER_PRO_TARGETS.find(
      (target) => target.profileId === item.target.profileId,
    )
    if (!approved || JSON.stringify(approved) !== JSON.stringify(item.target)) {
      throw new Error(`Dry-run contém perfil fora do censo aprovado: ${item.target.profileId}`)
    }
    assertExpectedWindow(approved)
    validateCommercialTargetSnapshot(approved, item.current)
    const expectedAction = resolveCommercialPlanAction(withExpectedWindow(item.current, approved))
    if (item.action !== expectedAction) {
      throw new Error(`Dry-run contém ação divergente para ${item.target.profileId}`)
    }
    if (
      item.after.userTypeSlug !== "member_pro" ||
      item.after.accessStartsAt !== approved.accessStartsAt ||
      item.after.accessExpiresAt !== approved.accessExpiresAt ||
      item.after.hasUnlimitedUsers !== true ||
      item.asaasMutation !== false
    ) {
      throw new Error(`Dry-run contém efeito inválido para ${item.target.profileId}`)
    }
  }

  if (seenProfileIds.size !== approvedProfileIds.size || [...approvedProfileIds].some((id) => !seenProfileIds.has(id))) {
    throw new Error("Dry-run não contém exatamente todos os perfis do censo comercial aprovado")
  }
}

function toIso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null
}

function assertExpectedWindow(target: CommercialTarget): void {
  const start = new Date(target.accessStartsAt)
  const expected = resolveMemberProAccessWindow({ start })
  if (expected.accessExpiresAt.toISOString() !== target.accessExpiresAt) {
    throw new Error(`Censo inválido para ${target.teamName}: janela não corresponde a 100 dias`)
  }
}

export function validateCommercialTargetSnapshot(target: CommercialTarget, snapshot: TargetSnapshot): void {
  if (!snapshot.isMaster || snapshot.deletedAt) {
    throw new Error(`Perfil ${target.profileId} não é um master ativo`)
  }
  if (snapshot.email !== target.email) {
    throw new Error(`E-mail divergente para ${target.teamName}`)
  }
  if (snapshot.hasPermanentSubscription) {
    throw new Error(`Perfil ${target.profileId} possui assinatura vitalícia`)
  }
  if (snapshot.activeBan) {
    throw new Error(`Perfil ${target.profileId} possui banimento de conta ativo`)
  }
  if (!snapshot.team || snapshot.team.id !== target.teamId || snapshot.team.name !== target.teamName || snapshot.team.masterId !== target.profileId || snapshot.team.deletedAt) {
    throw new Error(`Time divergente para ${target.teamName}`)
  }
  if (snapshot.subscriptionStartDate !== target.accessStartsAt) {
    throw new Error(`Início da assinatura divergente para ${target.teamName}`)
  }
  if (snapshot.profileSubscriptionStartDate !== target.accessStartsAt) {
    throw new Error(`Início da assinatura relacionada divergente para ${target.teamName}`)
  }
}

export function resolveCommercialPlanAction(snapshot: TargetSnapshotWithExpectedWindow): Action {
  const assignment = snapshot.assignment
  const isCorrectAssignment =
    assignment?.userTypeSlug === "member_pro" &&
    assignment.accessStartsAt === snapshot.expectedAccessStartsAt &&
    assignment.accessExpiresAt === snapshot.expectedAccessExpiresAt

  if (isCorrectAssignment && snapshot.hasUnlimitedUsers) return "already-correct"
  return assignment ? "update-member-pro" : "create-member-pro"
}

type QueryClient = Pick<Prisma.TransactionClient, "profile" | "team" | "backofficeBannedUser">

async function loadTargetSnapshot(client: QueryClient, target: CommercialTarget): Promise<TargetSnapshot> {
  const [profile, team] = await Promise.all([
    client.profile.findUnique({
      where: { id: target.profileId },
      select: {
        id: true,
        email: true,
        isMaster: true,
        deletedAt: true,
        hasPermanentSubscription: true,
        hasUnlimitedUsers: true,
        subscriptionStartDate: true,
        subscription: { select: { subscriptionStartDate: true } },
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        asaasSubscriptionId: true,
        asaasSubscriptionAccount: true,
        userTypeAssignment: {
          select: {
            accessStartsAt: true,
            accessExpiresAt: true,
            assignedByProfileId: true,
            userType: { select: { slug: true } },
          },
        },
      },
    }),
    client.team.findUnique({
      where: { id: target.teamId },
      select: { id: true, name: true, masterId: true, deletedAt: true },
    }),
  ])

  const activeBan = await client.backofficeBannedUser.findFirst({
    where: { profileId: target.profileId, status: "ACTIVE", scope: "ACCOUNT" },
    select: { id: true, reason: true },
  })

  const snapshot: TargetSnapshot = {
    profileId: profile?.id ?? target.profileId,
    email: profile?.email ?? "",
    isMaster: profile?.isMaster ?? false,
    deletedAt: toIso(profile?.deletedAt),
    hasPermanentSubscription: profile?.hasPermanentSubscription ?? false,
    hasUnlimitedUsers: profile?.hasUnlimitedUsers ?? false,
    subscriptionStartDate: toIso(profile?.subscriptionStartDate),
    profileSubscriptionStartDate: toIso(profile?.subscription?.subscriptionStartDate),
    asaasCustomerId: profile?.asaasCustomerId ?? null,
    asaasCustomerAccount: profile?.asaasCustomerAccount ?? "",
    asaasSubscriptionId: profile?.asaasSubscriptionId ?? null,
    asaasSubscriptionAccount: profile?.asaasSubscriptionAccount ?? "",
    assignment: profile?.userTypeAssignment
      ? {
          userTypeSlug: profile.userTypeAssignment.userType.slug,
          accessStartsAt: toIso(profile.userTypeAssignment.accessStartsAt),
          accessExpiresAt: toIso(profile.userTypeAssignment.accessExpiresAt),
          assignedByProfileId: profile.userTypeAssignment.assignedByProfileId,
        }
      : null,
    team: team
      ? {
          id: team.id,
          name: team.name,
          masterId: team.masterId,
          deletedAt: toIso(team.deletedAt),
        }
      : null,
    activeBan,
  }

  return snapshot
}

function withExpectedWindow(snapshot: TargetSnapshot, target: CommercialTarget): TargetSnapshotWithExpectedWindow {
  return {
    ...snapshot,
    expectedAccessStartsAt: target.accessStartsAt,
    expectedAccessExpiresAt: target.accessExpiresAt,
  }
}

export async function buildCommercialRepairPlan(): Promise<CommercialPlanItem[]> {
  const plan: CommercialPlanItem[] = []

  for (const target of COMMERCIAL_MEMBER_PRO_TARGETS) {
    assertExpectedWindow(target)
    const snapshot = await loadTargetSnapshot(prisma, target)
    validateCommercialTargetSnapshot(target, snapshot)
    const action = resolveCommercialPlanAction(withExpectedWindow(snapshot, target))
    plan.push({
      target,
      action,
      current: snapshot,
      after: {
        userTypeSlug: "member_pro",
        accessStartsAt: target.accessStartsAt,
        accessExpiresAt: target.accessExpiresAt,
        hasUnlimitedUsers: true,
      },
      asaasMutation: false,
    })
  }

  return plan
}

function assertApplyAuthorization(args: Arguments): void {
  if (!args.apply) return
  if (process.env[APPLY_ENV] !== "1") {
    throw new Error(`Recusado: --apply exige ${APPLY_ENV}=1`)
  }
  if (!args.input || !args.checksum) {
    throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  }
}

export function readCommercialDryRunReport(input: string, checksum: string): CommercialRepairReport {
  const report = JSON.parse(readFileSync(input, "utf-8")) as CommercialRepairReport
  if (report.apply || !Array.isArray(report.plan) || report.checksum !== checksum || calculateCommercialRepairChecksum(report.plan) !== checksum) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  assertApprovedCensus(report.plan)
  return report
}

function sameSnapshot(left: TargetSnapshot, right: TargetSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function applyCommercialRepair(plan: readonly CommercialPlanItem[]): Promise<Array<{ profileId: string; action: Action }>> {
  return prisma.$transaction(async (transaction) => {
    const results: Array<{ profileId: string; action: Action }> = []

    for (const item of plan) {
      const fresh = await loadTargetSnapshot(transaction, item.target)
      validateCommercialTargetSnapshot(item.target, fresh)
      if (!sameSnapshot(fresh, item.current)) {
        throw new Error(`Perfil ${item.target.profileId} mudou desde o dry-run; operação abortada`)
      }

      if (item.action === "already-correct") {
        results.push({ profileId: item.target.profileId, action: item.action })
        continue
      }

      const memberPro = await transaction.profileUserType.findUniqueOrThrow({
        where: { slug: "member_pro" },
        select: { id: true },
      })
      await transaction.profileUserTypeAssignment.upsert({
        where: { profileId: item.target.profileId },
        update: {
          userTypeId: memberPro.id,
          accessStartsAt: new Date(item.after.accessStartsAt),
          accessExpiresAt: new Date(item.after.accessExpiresAt),
          assignedByProfileId: item.current.assignment?.assignedByProfileId ?? null,
        },
        create: {
          profileId: item.target.profileId,
          userTypeId: memberPro.id,
          accessStartsAt: new Date(item.after.accessStartsAt),
          accessExpiresAt: new Date(item.after.accessExpiresAt),
          assignedByProfileId: null,
        },
      })

      if (!fresh.hasUnlimitedUsers) {
        await transaction.profile.update({
          where: { id: item.target.profileId },
          data: { hasUnlimitedUsers: true },
        })
      }

      await transaction.subscriptionChangeLog.create({
        data: {
          profileId: item.target.profileId,
          source: CHANGE_SOURCE,
          changeType: CHANGE_TYPE,
          before: {
            userType: fresh.assignment?.userTypeSlug ?? null,
            accessStartsAt: fresh.assignment?.accessStartsAt ?? null,
            accessExpiresAt: fresh.assignment?.accessExpiresAt ?? null,
            hasUnlimitedUsers: fresh.hasUnlimitedUsers,
          },
          after: item.after,
          metadata: {
            reason: "exceção comercial de criação Member PRO",
            teamId: item.target.teamId,
            teamName: item.target.teamName,
            asaasMutation: false,
          },
        },
      })
      results.push({ profileId: item.target.profileId, action: item.action })
    }

    return results
  })
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  const report = args.apply
    ? readCommercialDryRunReport(args.input!, args.checksum!)
    : {
        generatedAt: new Date().toISOString(),
        apply: false,
        plan: await buildCommercialRepairPlan(),
        checksum: "",
      }
  const resolvedReport = report.checksum
    ? report
    : { ...report, checksum: calculateCommercialRepairChecksum(report.plan) }
  const results = args.apply ? await applyCommercialRepair(resolvedReport.plan) : []
  const output = { ...resolvedReport, apply: args.apply, outcome: args.apply ? "applied" : "planned", results }
  if (args.output) writeFileSync(args.output, JSON.stringify(output, null, 2), "utf-8")
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

if (import.meta.main) {
  main()
    .catch((error) => {
      console.error("[repair-member-pro-commercial-exceptions] erro fatal:", error)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
