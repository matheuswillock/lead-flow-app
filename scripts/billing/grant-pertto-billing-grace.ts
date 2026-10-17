import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { isAccountMasterBanned } from "@/lib/account/isAccountMasterBanned"
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase"
import {
  isApprovedPerttoActivationOverride,
  isExactPerttoCrmEntitlement,
  resolveApprovedPerttoExpiry,
  validatePerttoApplyState,
} from "./perttoBillingGracePolicy"

const APPLY_ENV = "PERTTO_BILLING_GRACE_APPLY"
const CHANGE_SOURCE = "pertto_billing_grace"
const CHANGE_TYPE = "temporary_billing_access_granted"
const REPAIR_CHANGE_TYPE = "temporary_billing_access_expiry_repaired"
const RESTORE_CHANGE_TYPE = "manual_access_override_restored_to_past_due"
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
  action: "grant" | "repair-expiry" | "already-correct"
  restorePastDue: boolean
  currentGrace: { id: string; expiresAt: string | null; isActive: boolean } | null
  asaasMutation: false
}
type Report = { generatedAt: string; apply: boolean; plan: Plan; checksum: string }

// O Data Cache do Next só existe dentro de uma request do servidor. Em um
// script local não há tag remota para invalidar; a reconsulta abaixo garante
// que a decisão seja calculada novamente diretamente no banco.
function invalidateLocalAccessCache(): { cacheInvalidated: false; strategy: "database-revalidation" } {
  return { cacheInvalidated: false, strategy: "database-revalidation" }
}

function parseArguments(argv: readonly string[]): Args {
  const value = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
  return { apply: argv.includes("--apply"), input: value("input"), output: value("output"), checksum: value("checksum"), expiresAt: value("expires-at") }
}

function checksum(plan: Plan): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex")
}

function assertIsoExpiry(value: string | undefined): string {
  return resolveApprovedPerttoExpiry(value)
}

function assertApplyAuthorization(args: Args): void {
  if (!args.apply) return
  if (process.env[APPLY_ENV] !== "1") throw new Error(`Recusado: --apply exige ${APPLY_ENV}=1`)
  if (!args.input || !args.checksum) throw new Error("Recusado: --apply exige --input=<dry-run.json> e --checksum=<checksum>")
  const operatorProfileId = process.env.BILLING_GRACE_OPERATOR_PROFILE_ID
  if (!operatorProfileId) throw new Error("Recusado: informe BILLING_GRACE_OPERATOR_PROFILE_ID")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operatorProfileId)) {
    throw new Error("Recusado: BILLING_GRACE_OPERATOR_PROFILE_ID deve ser um UUID real; não use <UUID_DO_OPERADOR>")
  }
}

function readReport(path: string, expectedChecksum: string): Report {
  const report = JSON.parse(readFileSync(path, "utf8")) as Report
  if (report.apply || report.checksum !== expectedChecksum || checksum(report.plan) !== expectedChecksum) {
    throw new Error("Dry-run inválido ou checksum divergente; gere um novo relatório")
  }
  return report
}

async function buildPlan(expiresAt: string): Promise<Plan> {
  const [team, profile, canonicalSubscription, overrideLog, activeGraces] = await Promise.all([
    prisma.team.findUnique({ where: { id: TARGET.teamId }, select: { id: true, name: true, masterId: true, deletedAt: true } }),
    prisma.profile.findUnique({ where: { id: TARGET.profileId }, select: { id: true, email: true, isMaster: true, deletedAt: true, subscriptionStatus: true, asaasSubscriptionId: true, subscriptionId: true } }),
    prisma.profileSubscription.findUnique({ where: { profileId: TARGET.profileId }, select: { subscriptionStatus: true, asaasSubscriptionId: true, product: { select: { featureSlugs: true } } } }),
    prisma.subscriptionChangeLog.findFirst({
      where: { profileId: TARGET.profileId, source: "operational_manual_access_override", changeType: "activate_access_pertto_only" },
      orderBy: { createdAt: "desc" },
      select: { source: true, changeType: true, before: true, after: true, metadata: true },
    }),
    prisma.billingAccessGrace.findMany({ where: { teamId: TARGET.teamId, isActive: true }, orderBy: { createdAt: "desc" }, select: { id: true, expiresAt: true, isActive: true } }),
  ])

  if (!team || team.deletedAt || team.name !== TARGET.teamName || team.masterId !== TARGET.profileId) throw new Error("Pertto não corresponde ao censo aprovado")
  if (!profile || profile.deletedAt || profile.id !== TARGET.profileId || profile.email !== TARGET.email || !profile.isMaster) throw new Error("Master da Pertto não corresponde ao censo aprovado")
  const alreadyPastDue = profile.subscriptionStatus === "past_due" && canonicalSubscription?.subscriptionStatus === "past_due"
  const restorePastDue = !alreadyPastDue && isApprovedPerttoActivationOverride({
    profileStatus: profile.subscriptionStatus,
    canonicalStatus: canonicalSubscription?.subscriptionStatus ?? null,
    profileAsaasSubscriptionId: profile.asaasSubscriptionId ?? profile.subscriptionId,
    canonicalAsaasSubscriptionId: canonicalSubscription?.asaasSubscriptionId ?? null,
    overrideLog,
  })
  if (!alreadyPastDue && !restorePastDue) throw new Error("Status de cobrança diverge do estado past_due ou do override manual auditado")
  if (!canonicalSubscription?.product || !isExactPerttoCrmEntitlement(canonicalSubscription.product.featureSlugs)) {
    throw new Error("O entitlement canônico da Pertto não está limitado ao produto CRM")
  }
  if (activeGraces.length > 1) throw new Error("Há múltiplas concessões ativas para a Pertto; resolução manual necessária")
  const activeGrace = activeGraces[0] ?? null
  if (await isAccountMasterBanned(TARGET.profileId)) throw new Error("Master da Pertto está banido; operação abortada")
  const plan: Plan = {
    target: TARGET,
    expiresAt,
    action: !activeGrace ? "grant" : activeGrace.expiresAt?.toISOString() === expiresAt ? "already-correct" : "repair-expiry",
    restorePastDue,
    currentGrace: activeGrace
      ? { id: activeGrace.id, expiresAt: activeGrace.expiresAt?.toISOString() ?? null, isActive: activeGrace.isActive }
      : null,
    asaasMutation: false,
  }
  return plan
}

async function applyPlan(plan: Plan): Promise<void> {
  const operatorProfileId = process.env.BILLING_GRACE_OPERATOR_PROFILE_ID!
  await prisma.$transaction(async (tx) => {
    const [team, profile, canonicalSubscription, overrideLog, operator, activeGraces] = await Promise.all([
      tx.team.findUnique({ where: { id: TARGET.teamId }, select: { id: true, name: true, masterId: true, deletedAt: true } }),
      tx.profile.findUnique({ where: { id: TARGET.profileId }, select: { id: true, email: true, isMaster: true, deletedAt: true, subscriptionStatus: true, asaasSubscriptionId: true, subscriptionId: true } }),
      tx.profileSubscription.findUnique({ where: { profileId: TARGET.profileId }, select: { subscriptionStatus: true, asaasSubscriptionId: true, product: { select: { featureSlugs: true } } } }),
      tx.subscriptionChangeLog.findFirst({
        where: { profileId: TARGET.profileId, source: "operational_manual_access_override", changeType: "activate_access_pertto_only" },
        orderBy: { createdAt: "desc" },
        select: { source: true, changeType: true, before: true, after: true, metadata: true },
      }),
      tx.profile.findUnique({ where: { id: operatorProfileId }, select: { id: true } }),
      tx.billingAccessGrace.findMany({ where: { teamId: TARGET.teamId, isActive: true }, orderBy: { createdAt: "desc" }, select: { id: true, expiresAt: true } }),
    ])
    if (!operator) throw new Error("Operador de auditoria não encontrado")
    if (!team || team.deletedAt || team.name !== TARGET.teamName || team.masterId !== TARGET.profileId) throw new Error("Pertto mudou desde o dry-run")
    if (!profile || profile.deletedAt || profile.email !== TARGET.email || !profile.isMaster) throw new Error("Master da Pertto mudou desde o dry-run")
    if (!canonicalSubscription?.product || !isExactPerttoCrmEntitlement(canonicalSubscription.product.featureSlugs)) throw new Error("O entitlement da Pertto mudou desde o dry-run")
    const { activeGrace, alreadyPastDue, graceAlreadyApplied } = validatePerttoApplyState({
      profileStatus: profile.subscriptionStatus,
      canonicalStatus: canonicalSubscription.subscriptionStatus,
      profileAsaasSubscriptionId: profile.asaasSubscriptionId ?? profile.subscriptionId,
      canonicalAsaasSubscriptionId: canonicalSubscription.asaasSubscriptionId,
      overrideLog,
      restorePastDue: plan.restorePastDue,
      expiry: plan.expiresAt,
      plannedGrace: plan.currentGrace,
      activeGraces,
    })
    const activeBan = await tx.backofficeBannedUser.findFirst({
      where: { profileId: TARGET.profileId, status: "ACTIVE", scope: "ACCOUNT" },
      select: { id: true },
    })
    if (activeBan) throw new Error("Master da Pertto foi banido durante a operação")
    if (alreadyPastDue && graceAlreadyApplied) return
    if (activeGrace) {
      if (activeGrace.expiresAt?.toISOString() !== plan.expiresAt) {
        await tx.billingAccessGrace.update({
          where: { id: activeGrace.id },
          data: { expiresAt: new Date(plan.expiresAt), reason: "liberação operacional da Pertto somente para CRM até 27/10/2026; expiração automática", grantedByProfileId: operatorProfileId },
        })
      }
    } else {
      await tx.billingAccessGrace.create({
        data: { teamId: TARGET.teamId, reason: "liberação operacional da Pertto somente para CRM até 27/10/2026; expiração automática", expiresAt: new Date(plan.expiresAt), grantedByProfileId: operatorProfileId },
      })
    }

    if (plan.restorePastDue) {
      await tx.profile.update({ where: { id: TARGET.profileId }, data: { subscriptionStatus: "past_due" } })
      await tx.profileSubscription.update({ where: { profileId: TARGET.profileId }, data: { subscriptionStatus: "past_due" } })
    }
    await tx.subscriptionChangeLog.create({
      data: {
        profileId: TARGET.profileId,
        actorProfileId: operatorProfileId,
        source: CHANGE_SOURCE,
        changeType: plan.restorePastDue ? RESTORE_CHANGE_TYPE : activeGrace ? REPAIR_CHANGE_TYPE : CHANGE_TYPE,
        before: { subscriptionStatus: profile.subscriptionStatus, canonicalSubscriptionStatus: canonicalSubscription.subscriptionStatus, teamId: TARGET.teamId },
        after: { subscriptionStatus: "past_due", canonicalSubscriptionStatus: "past_due", temporaryAccessUntil: plan.expiresAt, teamId: TARGET.teamId },
        metadata: { reason: "operational billing grace scoped to CRM", restoredManualOverride: plan.restorePastDue, asaasMutation: false },
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
  const cache = args.apply ? invalidateLocalAccessCache() : { cacheInvalidated: false as const, strategy: "database-revalidation" as const }
  const decisionOutput = await accountAccessDecisionUseCase.execute({ profileId: TARGET.profileId, teamId: TARGET.teamId })
  const finalDecision = decisionOutput.isValid && decisionOutput.result ? (decisionOutput.result as { state?: string }) : null
  if (args.apply && finalDecision?.state !== "allowed") throw new Error("Aplicação concluída, mas a decisão final não está allowed")
  const output = { ...report, apply: args.apply, outcome: args.apply ? "applied" : "planned", finalDecision: finalDecision?.state ?? "unavailable", ...cache, asaasMutation: false }
  if (args.output) writeFileSync(args.output, JSON.stringify(output, null, 2), { encoding: "utf8", mode: 0o600 })
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[grant-pertto-billing-grace] erro fatal:", error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
