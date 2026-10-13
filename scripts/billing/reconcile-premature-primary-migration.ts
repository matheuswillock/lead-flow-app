import { writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"

const TARGET = {
  profileId: "56f2cbb7-4625-4bcc-b18b-bc3667f71bc3",
  subscriptionId: "sub_f73ml33mzji60gce",
  externalReference: "asaas-migration:pix:sub_nty1ubm96u7ircde",
}

type Arguments = { apply: boolean; output?: string }

function parseArguments(argv: string[]): Arguments {
  const output = argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length)
  return { apply: argv.includes("--apply"), output }
}

function assertApplyAuthorized(apply: boolean): void {
  if (!apply) return
  if (process.env.ASAAS_PRE_DUE_MIGRATION_RECONCILIATION_APPLY !== "1") {
    throw new Error("Recusado: --apply exige ASAAS_PRE_DUE_MIGRATION_RECONCILIATION_APPLY=1")
  }
  if (process.env.ASAAS_ENV !== "production") {
    throw new Error("Recusado: reconciliação exige ASAAS_ENV=production")
  }
}

function isPayable(status: string): boolean {
  return status === "PENDING" || status === "OVERDUE"
}

async function readLocalState() {
  const profile = await prisma.profile.findUnique({
    where: { id: TARGET.profileId },
    select: {
      id: true,
      email: true,
      asaasCustomerId: true,
      asaasCustomerAccount: true,
      asaasSubscriptionId: true,
      asaasSubscriptionAccount: true,
      subscriptionStatus: true,
      subscriptionNextDueDate: true,
    },
  })
  if (!profile) throw new Error("Profile alvo não encontrado")
  return profile
}

async function buildReport(apply: boolean) {
  const profile = await readLocalState()
  if (profile.asaasCustomerAccount !== "primary" || profile.asaasSubscriptionAccount !== "primary") {
    throw new Error("Profile alvo não aponta para a conta primary; operação abortada")
  }
  const remoteSubscription = await asaasMigrationGateway.findPrimarySubscription?.(TARGET.subscriptionId)
  if (!remoteSubscription) throw new Error("Assinatura primary alvo não encontrada")
  if (remoteSubscription.externalReference !== TARGET.externalReference) {
    throw new Error("Referência externa da assinatura primary divergente")
  }
  if (profile.asaasCustomerId && remoteSubscription.customer !== profile.asaasCustomerId) {
    throw new Error("Customer da assinatura primary divergente do profile")
  }
  const payments = await asaasMigrationGateway.listPrimarySubscriptionPayments?.(TARGET.subscriptionId)
  if (!payments) throw new Error("Gateway não consegue listar cobranças primary")

  const payablePayments = payments.filter((payment) =>
    isPayable(payment.status) &&
    (payment.subscription === TARGET.subscriptionId || payment.externalReference === TARGET.externalReference),
  )

  return {
    generatedAt: new Date().toISOString(),
    apply,
    target: TARGET,
    local: profile,
    remote: {
      subscription: remoteSubscription,
      payments: payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate ?? null,
        externalReference: payment.externalReference ?? null,
      })),
      payablePaymentIds: payablePayments.map((payment) => payment.id),
    },
  }
}

async function applyReconciliation(report: Awaited<ReturnType<typeof buildReport>>): Promise<void> {
  if (!asaasMigrationGateway.cancelPrimaryPayment || !asaasMigrationGateway.inactivatePrimarySubscription) {
    throw new Error("Gateway incompleto para reconciliar assinatura primary")
  }
  if (report.remote.subscription.id !== TARGET.subscriptionId) {
    throw new Error("Assinatura remota divergente; operação abortada")
  }

  for (const paymentId of report.remote.payablePaymentIds) {
    const canceled = await asaasMigrationGateway.cancelPrimaryPayment(paymentId)
    if (!canceled) throw new Error(`Asaas não confirmou cancelamento de ${paymentId}`)
  }

  if (report.remote.subscription.status !== "INACTIVE") {
    const inactivated = await asaasMigrationGateway.inactivatePrimarySubscription(TARGET.subscriptionId)
    if (inactivated.status !== "INACTIVE") throw new Error("Asaas não confirmou inativação da assinatura primary")
  }

  const remaining = await asaasMigrationGateway.listPrimarySubscriptionPayments(TARGET.subscriptionId)
  if (remaining.some((payment) => isPayable(payment.status))) {
    throw new Error("Ainda existe cobrança primary pagável após a reconciliação")
  }

  await prisma.$transaction(async (transaction) => {
    const profile = await transaction.profile.findUnique({
      where: { id: TARGET.profileId },
      select: { asaasSubscriptionId: true, asaasSubscriptionAccount: true, subscriptionStatus: true },
    })
    if (!profile) throw new Error("Profile desapareceu durante a reconciliação")
    if (profile.asaasSubscriptionId && profile.asaasSubscriptionId !== TARGET.subscriptionId) {
      throw new Error("Ponteiro local divergente; nenhuma atualização foi aplicada")
    }

    const profilePointerWasCleared = profile.asaasSubscriptionId === TARGET.subscriptionId
    if (profilePointerWasCleared) {
      await transaction.profile.update({
        where: { id: TARGET.profileId },
        data: { asaasSubscriptionId: null, asaasSubscriptionAccount: "primary" },
      })
    }
    const clearedSubscriptions = await transaction.profileSubscription.updateMany({
      where: { profileId: TARGET.profileId, asaasSubscriptionId: TARGET.subscriptionId },
      data: { asaasSubscriptionId: null, asaasSubscriptionAccount: "primary" },
    })
    if (clearedSubscriptions.count > 1) {
      throw new Error("Mais de um ponteiro ProfileSubscription aponta para a assinatura; operação abortada")
    }
    if (profilePointerWasCleared || clearedSubscriptions.count > 0) {
      await transaction.subscriptionChangeLog.create({
        data: {
          profileId: TARGET.profileId,
          source: "asaas_premature_primary_migration_reconciliation",
          changeType: "premature_primary_subscription_inactivated",
          before: profile,
          after: { asaasSubscriptionId: null, asaasSubscriptionAccount: "primary" },
          metadata: {
            subscriptionId: TARGET.subscriptionId,
            externalReference: TARGET.externalReference,
            payablePaymentIds: report.remote.payablePaymentIds,
          },
        },
      })
    }
  })

  const migration = await asaasAccountMigrationRepository.findByLegacyCustomerId("cus_000197332250")
  if (migration?.status === "done") {
    await asaasAccountMigrationRepository.reopenAfterPrematureReconciliation({
      legacyCustomerId: "cus_000197332250",
      primarySubscriptionId: TARGET.subscriptionId,
      anomalyNotes: "Assinatura primary criada antes do vencimento; inativada sem cobrança antecipada",
    })
  } else if (migration && migration.status !== "awaiting_due_date" && migration.status !== "requires_card_reauth") {
    await asaasAccountMigrationRepository.transition({
      legacyCustomerId: "cus_000197332250",
      toStatus: "awaiting_due_date",
      primaryCustomerId: migration.primaryCustomerId ?? undefined,
      primarySubscriptionId: TARGET.subscriptionId,
      anomalyNotes: "Assinatura primary criada antes do vencimento; inativada sem cobrança antecipada",
    })
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorized(args.apply)
  const report = await buildReport(args.apply)
  if (args.apply) await applyReconciliation(report)
  const output = { ...report, outcome: args.apply ? "applied" : "planned" }
  if (args.output) writeFileSync(args.output, JSON.stringify(output, null, 2))
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[reconcile-premature-primary-migration] erro fatal:", error)
  process.exitCode = 1
})
