import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned"

const TARGET = {
  profileId: "2a72272f-56f2-4104-9952-5d3d8b19ff1d",
  email: "rodrigo.c.arruda@rcacc.com.br",
  teamId: "27edf455-e61a-48a9-a846-e2c6f42999b5",
  teamName: "RCACC Seguros",
} as const

const APPLY_ENV = "RCACC_TEMP_ACCESS_APPLY"
const SOURCE = "rcacc_temporary_crm_access_workaround"

type Mode = "apply" | "restore"
type Args = { mode: Mode; input?: string; output?: string; checksum?: string }

export type AccessPlan = {
  target: typeof TARGET
  expiresAt: string
  before: {
    profileStatus: string | null
    profileSubscriptionStatus: string | null
  }
  after: {
    profileStatus: "active"
    profileSubscriptionStatus: "active"
  }
  graceId: string
}

type Report = {
  generatedAt: string
  mode: Mode
  plan: AccessPlan
  checksum: string
}

export function calculateChecksum(plan: AccessPlan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

function parseArgs(argv: readonly string[]): Args {
  const value = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  const mode: Mode = argv.includes("--restore") ? "restore" : "apply"
  return { mode, input: value("input"), output: value("output"), checksum: value("checksum") }
}

function assertApplyAuthorization(args: Args): void {
  if (process.env[APPLY_ENV] !== "1") {
    throw new Error(`Recusado: aplicação exige ${APPLY_ENV}=1`)
  }
  if (!args.input || !args.checksum) {
    throw new Error("Recusado: aplicação exige --input=<dry-run.json> e --checksum=<checksum>")
  }
  if (!process.env.BILLING_GRACE_OPERATOR_PROFILE_ID) {
    throw new Error("Recusado: informe BILLING_GRACE_OPERATOR_PROFILE_ID")
  }
}

function readReport(path: string, expectedChecksum: string): Report {
  const report = JSON.parse(readFileSync(path, "utf8")) as Report
  if (report.checksum !== expectedChecksum || calculateChecksum(report.plan) !== expectedChecksum) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  return report
}

export function buildStatusChange(plan: AccessPlan, mode: Mode) {
  return mode === "apply"
    ? plan.after
    : plan.before
}

async function buildPlan(): Promise<AccessPlan> {
  const [team, profile, subscription, grace, crmEntitlement] = await Promise.all([
    prisma.team.findUnique({
      where: { id: TARGET.teamId },
      select: { id: true, name: true, masterId: true, deletedAt: true },
    }),
    prisma.profile.findUnique({
      where: { id: TARGET.profileId },
      select: {
        id: true,
        email: true,
        isMaster: true,
        deletedAt: true,
        subscriptionStatus: true,
        subscription: { select: { subscriptionStatus: true } },
      },
    }),
    prisma.profileSubscription.findUnique({
      where: { profileId: TARGET.profileId },
      select: { subscriptionStatus: true },
    }),
    prisma.billingAccessGrace.findFirst({
      where: {
        teamId: TARGET.teamId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { expiresAt: "desc" },
      select: { id: true, expiresAt: true },
    }),
    prisma.backofficeUserSubscription.findFirst({
      where: {
        profileId: TARGET.profileId,
        status: "active",
        product: { featureSlugs: { has: "crm" } },
      },
      select: { id: true },
    }),
  ])

  if (!team || team.deletedAt || team.name !== TARGET.teamName || team.masterId !== TARGET.profileId) {
    throw new Error("Time RCACC não corresponde ao alvo aprovado")
  }
  if (!profile || profile.deletedAt || profile.email !== TARGET.email || !profile.isMaster) {
    throw new Error("Perfil master do RCACC não corresponde ao alvo aprovado")
  }
  if (!subscription) throw new Error("ProfileSubscription do RCACC não encontrada")
  if (!grace?.expiresAt) throw new Error("Grace ativo do RCACC não encontrado ou sem expiração")
  if (!crmEntitlement) throw new Error("Entitlement CRM ativo do RCACC não encontrado")
  if (await isAccountMasterBanned(TARGET.profileId)) throw new Error("Master do RCACC está banido")

  return {
    target: TARGET,
    expiresAt: grace.expiresAt.toISOString(),
    before: {
      profileStatus: profile.subscriptionStatus,
      profileSubscriptionStatus: subscription.subscriptionStatus,
    },
    after: { profileStatus: "active", profileSubscriptionStatus: "active" },
    graceId: grace.id,
  }
}

async function applyPlan(plan: AccessPlan, mode: Mode): Promise<void> {
  const operatorProfileId = process.env.BILLING_GRACE_OPERATOR_PROFILE_ID!
  const statuses = buildStatusChange(plan, mode)

  await prisma.$transaction(async (tx) => {
    const [profile, subscription, grace, operator] = await Promise.all([
      tx.profile.findUnique({
        where: { id: TARGET.profileId },
        select: { id: true, email: true, subscriptionStatus: true },
      }),
      tx.profileSubscription.findUnique({
        where: { profileId: TARGET.profileId },
        select: { subscriptionStatus: true },
      }),
      tx.billingAccessGrace.findUnique({
        where: { id: plan.graceId },
        select: { teamId: true, isActive: true, expiresAt: true },
      }),
      tx.profile.findUnique({ where: { id: operatorProfileId }, select: { id: true } }),
    ])

    if (!operator) throw new Error("Operador de auditoria não encontrado")
    if (!profile || profile.email !== TARGET.email) throw new Error("Perfil alvo mudou desde o dry-run")
    if (!subscription) throw new Error("ProfileSubscription alvo mudou desde o dry-run")
    if (!grace || grace.teamId !== TARGET.teamId || !grace.isActive || !grace.expiresAt || grace.expiresAt.toISOString() !== plan.expiresAt) {
      throw new Error("Grace do RCACC mudou desde o dry-run")
    }

    const expected = mode === "apply" ? plan.before : plan.after
    if (profile.subscriptionStatus !== expected.profileStatus || subscription.subscriptionStatus !== expected.profileSubscriptionStatus) {
      throw new Error("Status de assinatura mudou desde o dry-run; operação abortada")
    }

    await tx.profile.update({ where: { id: TARGET.profileId }, data: { subscriptionStatus: statuses.profileStatus } })
    await tx.profileSubscription.update({ where: { profileId: TARGET.profileId }, data: { subscriptionStatus: statuses.profileSubscriptionStatus } })
    await tx.subscriptionChangeLog.create({
      data: {
        profileId: TARGET.profileId,
        actorProfileId: operatorProfileId,
        source: SOURCE,
        changeType: mode === "apply" ? "temporary_crm_access_enabled" : "temporary_crm_access_restored",
        before: expected,
        after: statuses,
        metadata: {
          teamId: TARGET.teamId,
          graceId: plan.graceId,
          expiresAt: plan.expiresAt,
          asaasMutation: false,
          reason: "Workaround enquanto produção não reconhece BillingAccessGrace",
        },
      },
    })
  })
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const applying = Boolean(args.input && args.checksum)

  if (!applying) {
    if (args.mode === "restore") {
      throw new Error("Restauração exige o relatório original do apply em --input e --checksum")
    }
    const plan = await buildPlan()
    const report: Report = {
      generatedAt: new Date().toISOString(),
      mode: args.mode,
      plan,
      checksum: calculateChecksum(plan),
    }
    if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2), { encoding: "utf8", mode: 0o600 })
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }

  assertApplyAuthorization(args)
  const report = readReport(args.input!, args.checksum!)
  if (report.mode !== "apply") throw new Error("A restauração deve usar o relatório original do apply")
  await applyPlan(report.plan, args.mode)
  process.stdout.write(JSON.stringify({ ...report, outcome: args.mode === "apply" ? "applied" : "restored" }, null, 2) + "\n")
}

if (process.argv[1]?.endsWith("temporary-rcacc-crm-access.ts")) {
  main().catch((error) => {
    console.error("[temporary-rcacc-crm-access] erro fatal:", error)
    process.exitCode = 1
  }).finally(() => prisma.$disconnect())
}
