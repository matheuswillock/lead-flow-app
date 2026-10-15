import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned"

const APPLY_ENV = "PERTTO_BILLING_GRACE_APPLY"
const CHANGE_SOURCE = "pertto_billing_grace"
const CHANGE_TYPE = "temporary_billing_access_granted"
const TARGET = {
  teamId: "862835fd-54ad-4ebd-986a-b5392f1bb227",
  teamName: "Pertto Consultoria",
  profileId: "c0daec83-b339-449f-9255-98985fbb7b60",
  email: "guilherme@perttoconsultoria.com.br",
} as const

type Args = { apply: boolean; input?: string; output?: string; checksum?: string; expiresAt?: string }
type Plan = {
  target: typeof TARGET
  expiresAt: string
  action: "grant" | "already-granted"
  currentGrace: { id: string; expiresAt: string; isActive: boolean } | null
  asaasMutation: false
}
type Report = { generatedAt: string; apply: boolean; plan: Plan; checksum: string }

function parseArguments(argv: readonly string[]): Args {
  const value = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  return { apply: argv.includes("--apply"), input: value("input"), output: value("output"), checksum: value("checksum"), expiresAt: value("expires-at") }
}

function checksum(plan: Plan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

function assertIsoExpiry(value: string | undefined): string {
  if (!value) throw new Error("Informe --expires-at=<ISO-8601>; o prazo deve ser explícito")
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error("--expires-at deve ser uma data futura válida")
  return date.toISOString()
}

function assertApplyAuthorization(args: Args): void {
  if (!args.apply) return
  if (process.env[APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${APPLY_ENV}=1`)
  if (!args.input || !args.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  if (!process.env.BILLING_GRACE_OPERATOR_PROFILE_ID) throw new Error("Recusado: informe BILLING_GRACE_OPERATOR_PROFILE_ID")
}

function readReport(path: string, expectedChecksum: string): Report {
  const report = JSON.parse(readFileSync(path, "utf8")) as Report
  if (report.apply || report.checksum !== expectedChecksum || checksum(report.plan) !== expectedChecksum) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  return report
}

async function buildPlan(expiresAt: string): Promise<Plan> {
  const [team, profile, activeGrace] = await Promise.all([
    prisma.team.findUnique({ where: { id: TARGET.teamId }, select: { id: true, name: true, masterId: true, deletedAt: true } }),
    prisma.profile.findUnique({ where: { id: TARGET.profileId }, select: { id: true, email: true, isMaster: true, deletedAt: true, subscriptionStatus: true } }),
    prisma.billingAccessGrace.findFirst({ where: { teamId: TARGET.teamId, isActive: true, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" }, select: { id: true, expiresAt: true, isActive: true } }),
  ])

  if (!team || team.deletedAt || team.name !== TARGET.teamName || team.masterId !== TARGET.profileId) throw new Error("Pertto não corresponde ao censo aprovado")
  if (!profile || profile.deletedAt || profile.id !== TARGET.profileId || profile.email !== TARGET.email || !profile.isMaster) throw new Error("Master da Pertto não corresponde ao censo aprovado")
  if (profile.subscriptionStatus !== "past_due") throw new Error("A exceção só pode ser aplicada enquanto o pagamento estiver past_due")
  if (await isAccountMasterBanned(TARGET.profileId)) throw new Error("Master da Pertto está banido; operação abortada")
  if (activeGrace && (!activeGrace.expiresAt || activeGrace.expiresAt.toISOString() !== expiresAt)) {
    throw new Error("Já existe uma exceção ativa com prazo divergente")
  }

  const plan: Plan = {
    target: TARGET,
    expiresAt,
    action: activeGrace ? "already-granted" : "grant",
    currentGrace: activeGrace
      ? { id: activeGrace.id, expiresAt: activeGrace.expiresAt!.toISOString(), isActive: activeGrace.isActive }
      : null,
    asaasMutation: false,
  }
  return plan
}

async function applyPlan(plan: Plan): Promise<void> {
  const operatorProfileId = process.env.BILLING_GRACE_OPERATOR_PROFILE_ID!
  await prisma.$transaction(async (tx) => {
    const [team, profile, operator, activeGrace] = await Promise.all([
      tx.team.findUnique({ where: { id: TARGET.teamId }, select: { id: true, name: true, masterId: true, deletedAt: true } }),
      tx.profile.findUnique({ where: { id: TARGET.profileId }, select: { id: true, email: true, isMaster: true, deletedAt: true, subscriptionStatus: true } }),
      tx.profile.findUnique({ where: { id: operatorProfileId }, select: { id: true } }),
      tx.billingAccessGrace.findFirst({ where: { teamId: TARGET.teamId, isActive: true, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" }, select: { id: true, expiresAt: true } }),
    ])
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    if (!team || team.deletedAt || team.name !== TARGET.teamName || team.masterId !== TARGET.profileId) throw new Error("Pertto mudou desde o dry-run")
    if (!profile || profile.deletedAt || profile.email !== TARGET.email || !profile.isMaster) throw new Error("Master da Pertto mudou desde o dry-run")
    if (profile.subscriptionStatus !== "past_due") throw new Error("O pagamento deixou de estar pendente desde o dry-run")
    const activeBan = await tx.backofficeBannedUser.findFirst({
      where: { profileId: TARGET.profileId, status: "ACTIVE", scope: "ACCOUNT" },
      select: { id: true },
    })
    if (activeBan) throw new Error("Master da Pertto foi banido durante a operação")
    if (activeGrace) {
      if (!activeGrace.expiresAt || activeGrace.expiresAt.toISOString() !== plan.expiresAt) {
        throw new Error("Exceção existente diverge do dry-run")
      }
      return
    }

    await tx.billingAccessGrace.create({
      data: {
        teamId: TARGET.teamId,
        reason: "liberação operacional até confirmação de pagamento; expiração automática",
        expiresAt: new Date(plan.expiresAt),
        grantedByProfileId: operatorProfileId,
      },
    })
    await tx.subscriptionChangeLog.create({
      data: {
        profileId: TARGET.profileId,
        actorProfileId: operatorProfileId,
        source: CHANGE_SOURCE,
        changeType: CHANGE_TYPE,
        before: { subscriptionStatus: profile.subscriptionStatus, teamId: TARGET.teamId },
        after: { temporaryAccessUntil: plan.expiresAt, teamId: TARGET.teamId },
        metadata: { reason: "operational billing grace", asaasMutation: false, paymentStatusUnchanged: true },
      },
    })
  })
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  let report: Report
  if (args.apply) {
    report = readReport(args.input!, args.checksum!)
  } else {
    const plan = await buildPlan(assertIsoExpiry(args.expiresAt))
    report = { generatedAt: new Date().toISOString(), apply: false, plan, checksum: checksum(plan) }
  }
  if (args.apply) await applyPlan(report.plan)
  const output = { ...report, apply: args.apply, outcome: args.apply ? "applied" : "planned" }
  if (args.output) writeFileSync(args.output, JSON.stringify(output, null, 2), { encoding: "utf8", mode: 0o600 })
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[grant-pertto-billing-grace] erro fatal:", error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
