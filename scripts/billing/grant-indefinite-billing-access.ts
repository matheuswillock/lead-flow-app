import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

const APPLY_ENV = "INDEFINITE_BILLING_ACCESS_APPLY"
const OPERATOR_ENV = "BILLING_GRACE_OPERATOR_PROFILE_ID"
const CHANGE_SOURCE = "indefinite_billing_access"
const CHANGE_TYPE = "indefinite_billing_access_granted"

const CENSUS = [
  { teamId: "ebe67fdd-2e23-43c0-8e9b-8abec2682d09", teamName: "Bem Viver", profileId: "8794ad67-aa37-4f98-b1d3-bfd19ceaebf5", email: "bemviverseguros05@gmail.com" },
  { teamId: "a9c81e05-8b1a-47ad-a80d-dbc45603f068", teamName: "On | Select 1.0", profileId: "0c96a57e-6cc1-400f-bf3a-5740b699ac21", email: "bruno@onsidemarketing.com.br" },
  { teamId: "f68e3dcb-a2ae-4d1e-ae3a-0d01cd0835a9", teamName: "Seiko Corretora de Seguros", profileId: "b4f5dc09-072e-48b0-9168-79853aed1f6f", email: "patricia@seikoseguros.com.br" },
  { teamId: "e6a62f17-baad-4adc-a83c-a0b5cf84f83d", teamName: "Blackrock", profileId: "cb3ec6b4-1f4e-4e39-9150-e980c922f3ea", email: "deandrade.franci@gmail.com" },
  { teamId: "27edf455-e61a-48a9-a846-e2c6f42999b5", teamName: "RCACC Seguros", profileId: "2a72272f-56f2-4104-9952-5d3d8b19ff1d", email: "rodrigo.c.arruda@rcacc.com.br" },
  { teamId: "760fc14a-229e-4212-9aa9-f90de968af69", teamName: "RR Benefício", profileId: "1ed74e00-4a16-47cb-84fc-8021943b5fa3", email: "ricardo@rrbeneficios.com.br" },
  { teamId: "13bbd043-efcc-4c8a-9edd-f34941547546", teamName: "CPR", profileId: "0c96a57e-6cc1-400f-bf3a-5740b699ac21", email: "bruno@onsidemarketing.com.br" },
] as const

type Args = { apply: boolean; input?: string; output?: string; checksum?: string }
type PlanItem = {
  target: { teamId: string; teamName: string; profileId: string }
  action: "grant-indefinite" | "already-indefinite"
  currentGrace: { id: string; expiresAt: string | null; isActive: boolean } | null
  asaasMutation: false
}
type Report = { generatedAt: string; apply: boolean; plan: PlanItem[]; checksum: string }

function parseArguments(argv: readonly string[]): Args {
  const value = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  return { apply: argv.includes("--apply"), input: value("input"), output: value("output"), checksum: value("checksum") }
}

function calculateChecksum(plan: PlanItem[]): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

function assertApplyAuthorization(args: Args): void {
  if (!args.apply) return
  if (process.env[APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${APPLY_ENV}=1`)
  if (!args.input || !args.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  if (!process.env[OPERATOR_ENV]) throw new Error(`Recusado: informe ${OPERATOR_ENV}`)
}

function readDryRunReport(path: string, expectedChecksum: string): Report {
  const report = JSON.parse(readFileSync(path, "utf8")) as Report
  if (report.apply || report.checksum !== expectedChecksum || calculateChecksum(report.plan) !== expectedChecksum) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  if (report.plan.length !== CENSUS.length) throw new Error("Dry-run não contém o censo completo aprovado")
  for (const [index, item] of report.plan.entries()) {
    const expected = CENSUS[index]
    if (
      !expected ||
      item.target.teamId !== expected.teamId ||
      item.target.teamName !== expected.teamName ||
      item.target.profileId !== expected.profileId ||
      item.asaasMutation !== false ||
      !["grant-indefinite", "already-indefinite"].includes(item.action)
    ) {
      throw new Error("Dry-run não corresponde ao censo aprovado")
    }
  }
  return report
}

async function findCurrentGrace(teamId: string): Promise<{ id: string; expiresAt: Date | null; isActive: boolean } | null> {
  const indefinite = await prisma.billingAccessGrace.findFirst({
    where: { teamId, isActive: true, expiresAt: null },
    select: { id: true, expiresAt: true, isActive: true },
  })
  if (indefinite) return indefinite

  return prisma.billingAccessGrace.findFirst({
    where: { teamId, isActive: true },
    orderBy: { expiresAt: "desc" },
    select: { id: true, expiresAt: true, isActive: true },
  })
}

type DatabaseClient = Prisma.TransactionClient | typeof prisma

async function assertTarget(target: (typeof CENSUS)[number], transaction: DatabaseClient = prisma): Promise<void> {
  const [team, profile] = await Promise.all([
    transaction.team.findUnique({ where: { id: target.teamId }, select: { id: true, name: true, masterId: true, deletedAt: true } }),
    transaction.profile.findUnique({ where: { id: target.profileId }, select: { id: true, email: true, isMaster: true, deletedAt: true } }),
  ])
  if (!team || team.deletedAt || team.name !== target.teamName || team.masterId !== target.profileId) throw new Error(`Censo divergente: ${target.teamName}`)
  if (!profile || profile.deletedAt || profile.email !== target.email || !profile.isMaster) throw new Error(`Master divergente: ${target.teamName}`)
  const activeBan = await transaction.backofficeBannedUser.findFirst({
    where: { profileId: target.profileId, status: "ACTIVE", scope: "ACCOUNT" },
    select: { id: true },
  })
  if (activeBan) throw new Error(`Master banido: ${target.teamName}`)
}

async function buildPlan(): Promise<PlanItem[]> {
  const plan: PlanItem[] = []
  for (const target of CENSUS) {
    await assertTarget(target)
    const currentGrace = await findCurrentGrace(target.teamId)
    plan.push({
      target: { teamId: target.teamId, teamName: target.teamName, profileId: target.profileId },
      action: currentGrace?.expiresAt === null ? "already-indefinite" : "grant-indefinite",
      currentGrace: currentGrace ? { ...currentGrace, expiresAt: currentGrace.expiresAt?.toISOString() ?? null } : null,
      asaasMutation: false,
    })
  }
  return plan
}

async function applyItem(item: PlanItem): Promise<void> {
  const operatorProfileId = process.env[OPERATOR_ENV]!
  const target = CENSUS.find((candidate) => candidate.teamId === item.target.teamId)
  if (!target) throw new Error(`Time fora do censo aprovado: ${item.target.teamId}`)

  await prisma.$transaction(async (tx) => {
    const operator = await tx.profile.findUnique({ where: { id: operatorProfileId }, select: { id: true } })
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    await assertTarget(target, tx)
    const currentGrace = await tx.billingAccessGrace.findFirst({
      where: { teamId: target.teamId, isActive: true, expiresAt: null },
      select: { id: true },
    })
    if (currentGrace) return

    await tx.billingAccessGrace.create({
      data: {
        teamId: target.teamId,
        reason: "liberação operacional sem prazo definido; revogação manual obrigatória",
        expiresAt: null,
        grantedByProfileId: operatorProfileId,
      },
    })
    await tx.subscriptionChangeLog.create({
      data: {
        profileId: target.profileId,
        actorProfileId: operatorProfileId,
        source: CHANGE_SOURCE,
        changeType: CHANGE_TYPE,
        before: { teamId: target.teamId, temporaryAccessGranted: false },
        after: { teamId: target.teamId, temporaryAccessGranted: true, temporaryAccessUntil: null },
        metadata: { reason: "operational indefinite access", asaasMutation: false, paymentStatusUnchanged: true },
      },
    })
  })
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  const report = args.apply ? readDryRunReport(args.input!, args.checksum!) : { generatedAt: new Date().toISOString(), apply: false, plan: await buildPlan(), checksum: "" }
  const finalizedReport = report.checksum ? report : { ...report, checksum: calculateChecksum(report.plan) }
  if (args.apply) {
    for (const item of finalizedReport.plan) await applyItem(item)
  }
  const output = { ...finalizedReport, apply: args.apply, outcome: args.apply ? "applied" : "planned" }
  if (args.output) writeFileSync(args.output, JSON.stringify(output, null, 2), { encoding: "utf8", mode: 0o600 })
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[grant-indefinite-billing-access] erro fatal:", error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
