import { readFileSync, writeFileSync } from "node:fs"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import { asaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"
import { prisma } from "@/app/api/infra/data/prisma"
import { executeAsaasBatchMigration } from "./lib/executeAsaasBatchMigration"
import type { AsaasBatchMigrationPlanItem } from "./lib/asaasBatchMigrationPlan"

type PlanFile = { plan: AsaasBatchMigrationPlanItem[] }

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? null
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function assertApplyAuthorized(apply: boolean): void {
  if (!apply) return
  if (process.env.ASAAS_BATCH_MIGRATION_APPLY !== "1") throw new Error("--apply exige ASAAS_BATCH_MIGRATION_APPLY=1")
  if (process.env.ASAAS_ENV !== "production") throw new Error("--apply exige ASAAS_ENV=production")
}

async function loadCustomerProfiles(profileIds: string[]): Promise<Record<string, {
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
  externalReference: string
  notificationDisabled: boolean
}>> {
  const profiles = await prisma.profile.findMany({
    where: { id: { in: profileIds } },
    select: { id: true, fullName: true, email: true, cpfCnpj: true, phone: true },
  })
  return Object.fromEntries(profiles.map((profile) => [profile.id, {
    name: profile.fullName ?? profile.email,
    email: profile.email,
    cpfCnpj: profile.cpfCnpj ?? undefined,
    phone: profile.phone ?? undefined,
    externalReference: profile.id,
    notificationDisabled: true,
  }]))
}

async function persistMigration(plan: AsaasBatchMigrationPlanItem, primaryCustomerId: string, primarySubscriptionId: string): Promise<void> {
  if (!plan.profileId || !plan.value || !plan.cycle || !plan.nextDueDate) throw new Error("Plano sem dados locais para persistência")
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: plan.profileId },
    select: { fullName: true, email: true, asaasCustomerId: true, asaasSubscriptionId: true, subscriptionStatus: true },
  })
  let migration = await asaasAccountMigrationRepository.findByLegacyCustomerId(plan.legacyCustomerId)
  if (!migration) {
    migration = await asaasAccountMigrationRepository.upsertSnapshot({
      profileId: plan.profileId,
      clientName: profile.fullName ?? profile.email,
      clientEmail: profile.email,
      legacyCustomerId: plan.legacyCustomerId,
      legacySubscriptionId: plan.legacySubscriptionId,
      billingType: plan.billingType,
      cycle: plan.cycle,
      value: plan.value,
      nextDueDate: new Date(`${plan.nextDueDate}T12:00:00.000Z`),
    })
  }
  if (migration.status === "done") return
  if (migration.status === "pending") migration = await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "customer_created", primaryCustomerId })
  if (migration.status === "customer_created") migration = await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "subscription_created", primaryCustomerId, primarySubscriptionId })

  await prisma.$transaction(async (transaction) => {
    await transaction.profile.update({
      where: { id: plan.profileId },
      data: {
        asaasCustomerId: primaryCustomerId,
        asaasCustomerAccount: "primary",
        asaasSubscriptionId: primarySubscriptionId,
        asaasSubscriptionAccount: "primary",
        subscriptionStatus: "active",
        subscriptionNextDueDate: new Date(`${plan.nextDueDate}T12:00:00.000Z`),
        subscriptionCycle: plan.cycle,
      },
    })
    const updated = await transaction.profileSubscription.updateMany({
      where: { profileId: plan.profileId, asaasSubscriptionId: plan.legacySubscriptionId },
      data: {
        asaasSubscriptionId: primarySubscriptionId,
        asaasSubscriptionAccount: "primary",
        subscriptionStatus: "active",
        subscriptionNextDueDate: new Date(`${plan.nextDueDate}T12:00:00.000Z`),
        subscriptionCycle: plan.cycle,
      },
    })
    if (updated.count !== 1) throw new Error(`ProfileSubscription não atualizada de forma única (count=${updated.count})`)
  })

  if (migration.status === "subscription_created") migration = await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "legacy_deactivated", primaryCustomerId, primarySubscriptionId, legacyRemovedAt: new Date() })
  if (migration.status === "legacy_deactivated") await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "done", primaryCustomerId, primarySubscriptionId, migratedAt: new Date() })
}

async function blockAccess(profileId: string, reason: string): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.profile.update({ where: { id: profileId }, data: { subscriptionStatus: "past_due" } })
    await transaction.profileSubscription.updateMany({ where: { profileId }, data: { subscriptionStatus: "past_due" } })
  })
  console.info(`[batch-migration] acesso bloqueado profile=${profileId}: ${reason}`)
}

async function main(): Promise<void> {
  const planPath = argument("plan")
  const outputPath = argument("output")
  const apply = process.argv.includes("--apply")
  if (!planPath) throw new Error("Uso: --plan=plan.json [--output=report.json] [--apply]")
  assertApplyAuthorized(apply)
  const planFile = readJson<PlanFile>(planPath)
  if (!Array.isArray(planFile.plan)) throw new Error("Plano inválido: campo plan deve ser array")
  const profileIds = planFile.plan.flatMap((item) => item.profileId ? [item.profileId] : [])
  const customerProfiles = await loadCustomerProfiles(profileIds)
  const results = await executeAsaasBatchMigration({
    plans: planFile.plan,
    apply,
    gateway: {
      findCustomerByExternalReference: (externalReference) => asaasCustomerGateway.findCustomerByExternalReference?.(externalReference) ?? Promise.resolve(null),
      createCustomer: async (input) => asaasCustomerGateway.createCustomer({ ...input, profileId: input.externalReference }),
      findSubscriptionByExternalReference: (externalReference) => asaasMigrationGateway.findSubscriptionByExternalReference?.(externalReference) ?? Promise.resolve(null),
      createSubscription: (input) => asaasMigrationGateway.createSubscription(input),
      listLegacySubscriptionPayments: (subscriptionId) => asaasMigrationGateway.listLegacySubscriptionPayments!(subscriptionId),
      cancelLegacyPayment: (paymentId) => asaasMigrationGateway.cancelLegacyPayment!(paymentId),
      findLegacySubscription: (subscriptionId) => asaasMigrationGateway.findLegacySubscription!(subscriptionId),
      inactivateLegacySubscription: (subscriptionId) => asaasMigrationGateway.inactivateLegacySubscription!(subscriptionId),
    },
    customerProfiles,
    persistence: { persist: persistMigration, blockAccess },
  })
  const report = { generatedAt: new Date().toISOString(), apply, results }
  if (outputPath) writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8")
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[execute-asaas-batch-migration] erro fatal:", error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})
