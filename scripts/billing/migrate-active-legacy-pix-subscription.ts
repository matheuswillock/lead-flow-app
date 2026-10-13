/**
 * Migra uma assinatura PIX ativa da conta legacy para a primary.
 *
 * O comando é dry-run por padrão. Antes do vencimento, o apply apenas garante
 * o customer primary e mantém a migração aguardando checkout. A assinatura
 * recorrente só é criada no vencimento, após autorização explícita.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { prisma } from "@/app/api/infra/data/prisma"
import { asaasAccountMigrationRepository } from "@/app/api/infra/data/repositories/asaasAccountMigration/AsaasAccountMigrationRepository"
import { asaasMigrationGateway } from "@/app/api/infra/gateways/asaasMigration/AsaasMigrationGateway"
import { createAsaasClient } from "@/lib/asaas/asaas-client"
import { resolvePrice, toBillingCycle } from "@/lib/billing/resolvePrice"
import type { AsaasCustomer, AsaasPayment, AsaasSubscription } from "./lib/asaasInventoryTypes"

type Inventory = {
  account: string
  customers?: { data?: AsaasCustomer[] }
  subscriptions?: { data?: AsaasSubscription[] }
  pendingPayments?: { data?: AsaasPayment[] }
  overduePayments?: { data?: AsaasPayment[] }
}

type Target = {
  profileId: string
  legacyCustomerId: string
  legacySubscriptionId: string
  pendingPaymentId: string
}

type Arguments = {
  legacyInventory: string
  primaryInventory: string
  target: string
  output?: string
  apply: boolean
}

type MigrationPlan = {
  profileId: string
  legacyCustomerId: string
  legacySubscriptionId: string
  legacyPaymentId: string
  primaryCustomerId: string | null
  primarySubscriptionId: string | null
  sourceBillingType: string
  sourceCycle: string
  sourceValue: number
  targetValue: number
  sourceNextDueDate: string
  primaryNextDueDate: string
  externalReference: string
  alreadyMigrated: boolean
  dueReached: boolean
  warnings: string[]
}

type MigrationResult = MigrationPlan & {
  outcome: "planned" | "migrated" | "already-migrated" | "blocked"
  detail: string
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>()
  for (const argument of argv) {
    const separator = argument.indexOf("=")
    if (separator > 2) values.set(argument.slice(2, separator), argument.slice(separator + 1))
  }
  const legacyInventory = values.get("legacy-inventory")
  const primaryInventory = values.get("primary-inventory")
  const target = values.get("target")
  if (!legacyInventory || !primaryInventory || !target) {
    throw new Error("Uso: --legacy-inventory=... --primary-inventory=... --target=... [--output=...] [--apply]")
  }
  return {
    legacyInventory,
    primaryInventory,
    target,
    output: values.get("output"),
    apply: argv.includes("--apply"),
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T
}

function assertApplyAuthorized(args: Arguments): void {
  if (!args.apply) return
  if (process.env.ASAAS_ACTIVE_LEGACY_MIGRATION_APPLY !== "1") {
    throw new Error("Recusado: --apply exige ASAAS_ACTIVE_LEGACY_MIGRATION_APPLY=1")
  }
  if (process.env.ASAAS_ENV !== "production") {
    throw new Error("Recusado: migração ativa exige ASAAS_ENV=production")
  }
}

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ""
}

function isDueDateReached(date: string, now = new Date()): boolean {
  const due = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(due.getTime()) && due.getTime() <= now.getTime()
}

function findPayment(inventory: Inventory, paymentId: string): AsaasPayment | null {
  const payments = [
    ...(inventory.pendingPayments?.data ?? []),
    ...(inventory.overduePayments?.data ?? []),
  ]
  return payments.find((payment) => payment.id === paymentId) ?? null
}

function findUniqueCustomer(customers: AsaasCustomer[], predicate: (customer: AsaasCustomer) => boolean): AsaasCustomer | null {
  const matches = customers.filter(predicate)
  return matches.length === 1 ? matches[0]! : null
}

function buildCustomerPayload(profile: {
  fullName: string | null
  email: string
  cpfCnpj: string | null
  phone: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  complement: string | null
  neighborhood: string | null
  id: string
}) {
  return {
    name: profile.fullName ?? profile.email,
    email: profile.email,
    cpfCnpj: profile.cpfCnpj ?? undefined,
    phone: profile.phone ?? undefined,
    postalCode: profile.postalCode ?? undefined,
    address: profile.address ?? undefined,
    addressNumber: profile.addressNumber ?? undefined,
    complement: profile.complement ?? undefined,
    province: profile.neighborhood ?? undefined,
    externalReference: profile.id,
    notificationDisabled: true,
  }
}

async function buildPlan(args: Arguments): Promise<MigrationPlan> {
  const target = readJson<Target>(args.target)
  const legacy = readJson<Inventory>(args.legacyInventory)
  const primary = readJson<Inventory>(args.primaryInventory)
  if (legacy.account !== "legacy" || primary.account !== "primary") throw new Error("Inventários precisam ser legacy e primary")

  const profile = await prisma.profile.findUnique({
    where: { id: target.profileId },
    select: {
      id: true,
      fullName: true,
      email: true,
      cpfCnpj: true,
      phone: true,
      postalCode: true,
      address: true,
      addressNumber: true,
      complement: true,
      neighborhood: true,
      asaasCustomerId: true,
      asaasCustomerAccount: true,
      asaasSubscriptionId: true,
      asaasSubscriptionAccount: true,
      subscriptionNextDueDate: true,
      hasPermanentSubscription: true,
    },
  })
  if (!profile) throw new Error(`Profile ${target.profileId} não encontrado`)
  const existingLedger = await asaasAccountMigrationRepository.findByLegacyCustomerId(target.legacyCustomerId)
  const primaryCustomers = primary.customers?.data ?? []
  const externalReference = `asaas-migration:pix:${target.legacySubscriptionId}`
  const primarySubscription = (primary.subscriptions?.data ?? []).find((item) => item.externalReference === externalReference) ?? null
  const primaryDueSubscription = (primary.subscriptions?.data ?? []).find((item) =>
    item.externalReference?.startsWith(`${externalReference}:due:`),
  ) ?? null
  const recoveryPending = ["awaiting_due_date", "requires_card_reauth", "paused_awaiting_card"].includes(existingLedger?.status ?? "")
  const alreadyMigrated = existingLedger?.status === "done"
    && profile.asaasCustomerAccount === "primary"
    && profile.asaasSubscriptionAccount === "primary"
    && profile.asaasCustomerId === existingLedger.primaryCustomerId
    && profile.asaasSubscriptionId === existingLedger.primarySubscriptionId
    && (primarySubscription?.status === "ACTIVE" || primaryDueSubscription?.status === "ACTIVE")
  const localRecoveryPointer = recoveryPending
    && profile.asaasCustomerAccount === "primary"
    && profile.asaasSubscriptionId === null
  if (!alreadyMigrated && !localRecoveryPointer && (profile.asaasCustomerId !== target.legacyCustomerId || profile.asaasCustomerAccount !== "legacy")) {
    throw new Error("Ponteiro de customer local não corresponde ao alvo legacy")
  }
  if (!alreadyMigrated && !localRecoveryPointer && (profile.asaasSubscriptionId !== target.legacySubscriptionId || profile.asaasSubscriptionAccount !== "legacy")) {
    throw new Error("Ponteiro de assinatura local não corresponde ao alvo legacy")
  }
  if (profile.hasPermanentSubscription) throw new Error("Assinatura permanente não pode entrar nesta migração")

  const customer = legacy.customers?.data?.find((item) => item.id === target.legacyCustomerId)
  const subscription = legacy.subscriptions?.data?.find((item) => item.id === target.legacySubscriptionId)
  const payment = findPayment(legacy, target.pendingPaymentId)
  if (!customer || !subscription || (!payment && !alreadyMigrated)) throw new Error("Customer, assinatura ou pagamento não está no inventário legacy")
  if (!alreadyMigrated && subscription.status !== "ACTIVE") throw new Error(`Assinatura legacy está ${subscription.status}, não ACTIVE`)
  if (payment && (payment.customer !== target.legacyCustomerId || payment.subscription !== target.legacySubscriptionId)) {
    throw new Error("Pagamento alvo não pertence ao customer/assinatura informados")
  }
  if (payment && !["PENDING", "OVERDUE"].includes(payment.status)) throw new Error(`Pagamento alvo está ${payment.status}`)
  if (subscription.billingType !== "PIX") throw new Error(`Este script preserva apenas PIX; billingType=${subscription.billingType}`)
  const catalogCycle = toBillingCycle(subscription.cycle)
  const targetValue = catalogCycle
    ? await resolvePrice({ featureSlug: "crm", cycle: catalogCycle, method: "PIX" })
    : null
  if (targetValue == null) throw new Error("Preço CRM PIX do ciclo legado não está disponível no catálogo")

  const primaryCustomer =
    findUniqueCustomer(primaryCustomers, (item) => item.externalReference === target.profileId) ??
    findUniqueCustomer(primaryCustomers, (item) => normalize(item.email) === normalize(customer.email)) ??
    findUniqueCustomer(primaryCustomers, (item) => Boolean(customer.cpfCnpj) && item.cpfCnpj === customer.cpfCnpj)
  const primaryNextDueDate = payment?.dueDate ?? profile.subscriptionNextDueDate?.toISOString().slice(0, 10) ?? subscription.nextDueDate
  return {
    profileId: target.profileId,
    legacyCustomerId: target.legacyCustomerId,
    legacySubscriptionId: target.legacySubscriptionId,
    legacyPaymentId: target.pendingPaymentId,
    primaryCustomerId: alreadyMigrated ? profile.asaasCustomerId : (primaryCustomer?.id ?? null),
    primarySubscriptionId: alreadyMigrated
      ? profile.asaasSubscriptionId
      : (primarySubscription?.status === "ACTIVE" ? primarySubscription.id : primaryDueSubscription?.status === "ACTIVE" ? primaryDueSubscription.id : null),
    sourceBillingType: subscription.billingType,
    sourceCycle: subscription.cycle,
    sourceValue: subscription.value,
    targetValue,
    sourceNextDueDate: subscription.nextDueDate,
    primaryNextDueDate,
    externalReference,
    alreadyMigrated,
    dueReached: isDueDateReached(primaryNextDueDate),
    warnings: [
      "Antes do vencimento, nenhuma assinatura ou cobrança primary será criada.",
      "A assinatura primary só será criada no vencimento após checkout e autorização.",
    ],
  }
}

async function ensurePrimaryCustomer(plan: MigrationPlan, profile: Parameters<typeof buildCustomerPayload>[0], apply: boolean): Promise<string> {
  if (plan.primaryCustomerId) return plan.primaryCustomerId
  if (!apply) return "primary-customer-pending"
  const existing = await asaasMigrationGateway.findCustomerByExternalReference?.(profile.id)
  if (existing) return existing.id
  const client = createAsaasClient("primary")
  const response = await client.request(client.endpoints.customers, {
    method: "POST",
    body: JSON.stringify(buildCustomerPayload(profile)),
  })
  if (typeof response?.id !== "string") throw new Error("Asaas não retornou customer primary válido")
  return response.id
}

async function ensurePrimarySubscription(plan: MigrationPlan, primaryCustomerId: string, apply: boolean): Promise<string> {
  if (plan.alreadyMigrated && plan.primarySubscriptionId) return plan.primarySubscriptionId
  if (!apply) return "primary-subscription-pending"
  const dueExternalReference = `${plan.externalReference}:due:${plan.primaryNextDueDate}`
  const existing = await asaasMigrationGateway.findSubscriptionByExternalReference?.(plan.externalReference)
  if (existing?.status === "ACTIVE") {
    throw new Error("Assinatura primary antiga ainda está ACTIVE; reconcilie-a antes do vencimento")
  }
  const existingDue = await asaasMigrationGateway.findSubscriptionByExternalReference?.(dueExternalReference)

  if (existingDue) {
    if (
      existingDue.status !== "ACTIVE" ||
      existingDue.customer !== primaryCustomerId ||
      Math.abs(existingDue.value - plan.targetValue) > 0.005 ||
      existingDue.cycle !== plan.sourceCycle ||
      existingDue.nextDueDate !== plan.primaryNextDueDate
    ) {
      throw new Error("Assinatura primary existente divergente; revisão manual necessária")
    }
    return existingDue.id
  }

  const subscription = await asaasMigrationGateway.createSubscription({
    account: "primary",
    customerId: primaryCustomerId,
    value: plan.targetValue,
    cycle: plan.sourceCycle,
    billingType: plan.sourceBillingType,
    nextDueDate: plan.primaryNextDueDate,
    externalReference: dueExternalReference,
  })
  if (subscription.customer !== primaryCustomerId || subscription.status !== "ACTIVE") {
    throw new Error("Assinatura primary retornou customer/status divergente")
  }
  return subscription.id
}

async function migrateRemote(plan: MigrationPlan, primaryCustomerId: string, primarySubscriptionId: string): Promise<void> {
  if (!asaasMigrationGateway.listLegacySubscriptionPayments || !asaasMigrationGateway.cancelLegacyPayment || !asaasMigrationGateway.findLegacySubscription || !asaasMigrationGateway.inactivateLegacySubscription) {
    throw new Error("Gateway Asaas incompleto para migração ativa: operações legacy obrigatórias ausentes")
  }
  const payments = await asaasMigrationGateway.listLegacySubscriptionPayments(plan.legacySubscriptionId)
  for (const payment of (payments ?? []).filter((item) => ["PENDING", "OVERDUE"].includes(item.status))) {
    const canceled = await asaasMigrationGateway.cancelLegacyPayment(payment.id)
    if (!canceled) throw new Error(`Asaas não confirmou cancelamento de ${payment.id}`)
  }
  const remaining = await asaasMigrationGateway.listLegacySubscriptionPayments(plan.legacySubscriptionId)
  if ((remaining ?? []).some((item) => ["PENDING", "OVERDUE"].includes(item.status))) {
    throw new Error("Assinatura legacy ainda possui cobrança pagável")
  }
  const legacySubscription = await asaasMigrationGateway.findLegacySubscription(plan.legacySubscriptionId)
  if (legacySubscription && legacySubscription.status !== "INACTIVE") {
    await asaasMigrationGateway.inactivateLegacySubscription(plan.legacySubscriptionId)
  }
  const refreshed = await asaasMigrationGateway.findLegacySubscription(plan.legacySubscriptionId)
  if (refreshed && refreshed.status !== "INACTIVE") throw new Error("Asaas não confirmou inativação legacy")
  if (!primaryCustomerId || !primarySubscriptionId) throw new Error("Ponteiros primary ausentes")
}

async function updateLocalPointers(plan: MigrationPlan, primaryCustomerId: string, primarySubscriptionId: string): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const profile = await transaction.profile.findUnique({
      where: { id: plan.profileId },
      select: {
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        asaasSubscriptionId: true,
        asaasSubscriptionAccount: true,
        subscriptionStatus: true,
      },
    })
    if (!profile) throw new Error("Profile desapareceu antes da atualização local")
    const profileAlreadyUpdated = profile.asaasCustomerId === primaryCustomerId
      && profile.asaasCustomerAccount === "primary"
      && profile.asaasSubscriptionId === primarySubscriptionId
      && profile.asaasSubscriptionAccount === "primary"
    if (!profileAlreadyUpdated) {
      if (profile.asaasCustomerId !== plan.legacyCustomerId || profile.asaasSubscriptionId !== plan.legacySubscriptionId) {
        throw new Error("Ponteiros locais divergentes: recusando sobrescrever outro customer/assinatura")
      }
      await transaction.profile.update({
        where: { id: plan.profileId },
        data: {
          asaasCustomerId: primaryCustomerId,
          asaasCustomerAccount: "primary",
          asaasSubscriptionId: primarySubscriptionId,
          asaasSubscriptionAccount: "primary",
          subscriptionStatus: "active",
          subscriptionNextDueDate: new Date(`${plan.primaryNextDueDate}T12:00:00.000Z`),
          subscriptionCycle: plan.sourceCycle,
        },
      })
    }

    const localSubscription = await transaction.profileSubscription.findUnique({
      where: { profileId: plan.profileId },
      select: { asaasSubscriptionId: true, asaasSubscriptionAccount: true },
    })
    if (!localSubscription) throw new Error("ProfileSubscription desapareceu antes da atualização local")
    const subscriptionAlreadyUpdated = localSubscription.asaasSubscriptionId === primarySubscriptionId
      && localSubscription.asaasSubscriptionAccount === "primary"
    if (!subscriptionAlreadyUpdated) {
      if (localSubscription.asaasSubscriptionId !== plan.legacySubscriptionId) {
        throw new Error("ProfileSubscription divergente: recusando sobrescrever outra assinatura")
      }
      const updatedSubscriptions = await transaction.profileSubscription.updateMany({
        where: { profileId: plan.profileId, asaasSubscriptionId: plan.legacySubscriptionId },
        data: {
          asaasSubscriptionId: primarySubscriptionId,
          asaasSubscriptionAccount: "primary",
          subscriptionStatus: "active",
          subscriptionNextDueDate: new Date(`${plan.primaryNextDueDate}T12:00:00.000Z`),
          subscriptionCycle: plan.sourceCycle,
        },
      })
      if (updatedSubscriptions.count !== 1) {
        throw new Error(`Assinatura local não foi atualizada de forma única (count=${updatedSubscriptions.count})`)
      }
    }

    if (!profileAlreadyUpdated || !subscriptionAlreadyUpdated) {
      await transaction.subscriptionChangeLog.create({
        data: {
          profileId: plan.profileId,
          source: "asaas_active_pix_migration",
          changeType: "legacy_subscription_migrated_to_primary",
          before: profile,
          after: { asaasCustomerId: primaryCustomerId, asaasSubscriptionId: primarySubscriptionId, subscriptionStatus: "active" },
          metadata: { legacyCustomerId: plan.legacyCustomerId, legacySubscriptionId: plan.legacySubscriptionId, legacyPaymentId: plan.legacyPaymentId },
        },
      })
    }
  })
}

async function completeLedger(
  plan: MigrationPlan,
  primaryCustomerId: string,
  primarySubscriptionId: string | null,
  finish: boolean,
): Promise<void> {
  let migration = await asaasAccountMigrationRepository.findByLegacyCustomerId(plan.legacyCustomerId)
  if (!migration) {
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: plan.profileId }, select: { fullName: true, email: true } })
    migration = await asaasAccountMigrationRepository.upsertSnapshot({
      profileId: plan.profileId,
      clientName: profile.fullName ?? profile.email,
      clientEmail: profile.email,
      legacyCustomerId: plan.legacyCustomerId,
      legacySubscriptionId: plan.legacySubscriptionId,
      billingType: plan.sourceBillingType,
      cycle: plan.sourceCycle,
      value: plan.sourceValue,
      nextDueDate: new Date(`${plan.sourceNextDueDate}T12:00:00.000Z`),
    })
  }
  if (migration.status === "pending") {
    migration = await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "customer_created", primaryCustomerId })
  }
  if (migration.status === "customer_created") {
    migration = await asaasAccountMigrationRepository.transition({
      legacyCustomerId: plan.legacyCustomerId,
      toStatus: primarySubscriptionId ? "subscription_created" : "awaiting_due_date",
      primaryCustomerId,
      ...(primarySubscriptionId ? { primarySubscriptionId } : {}),
    })
  }
  if (finish && migration.status === "subscription_created") {
    migration = await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "legacy_deactivated", primaryCustomerId, primarySubscriptionId, legacyRemovedAt: new Date() })
  }
  if (finish && migration.status === "legacy_deactivated") {
    await asaasAccountMigrationRepository.transition({ legacyCustomerId: plan.legacyCustomerId, toStatus: "done", primaryCustomerId, primarySubscriptionId, migratedAt: new Date() })
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorized(args)
  const plan = await buildPlan(args)
  if (!args.apply) {
    const report: MigrationResult = {
      ...plan,
      outcome: plan.alreadyMigrated ? "already-migrated" : "planned",
      detail: plan.alreadyMigrated
        ? "ledger e ponteiros locais já confirmam a migração; nenhuma escrita é necessária"
        : plan.dueReached
          ? "customer e assinatura primary serão criados/reconciliados no vencimento; só depois o legacy será cancelado"
          : "customer primary será apenas preparado; assinatura e cobrança aguardam o vencimento e o checkout",
    }
    if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2))
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: plan.profileId },
    select: { id: true, fullName: true, email: true, cpfCnpj: true, phone: true, postalCode: true, address: true, addressNumber: true, complement: true, neighborhood: true },
  })
  const primaryCustomerId = await ensurePrimaryCustomer(plan, profile, true)
  if (!plan.dueReached) {
    await completeLedger(plan, primaryCustomerId, null, false)
    const report: MigrationResult = {
      ...plan,
      primaryCustomerId,
      primarySubscriptionId: null,
      outcome: "planned",
      detail: "customer primary confirmado; migração aguardando vencimento e checkout, sem cobrança ou assinatura recorrente",
    }
    if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2))
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    return
  }
  const primarySubscriptionId = await ensurePrimarySubscription(plan, primaryCustomerId, true)
  await completeLedger(plan, primaryCustomerId, primarySubscriptionId, false)
  await migrateRemote(plan, primaryCustomerId, primarySubscriptionId)
  await updateLocalPointers(plan, primaryCustomerId, primarySubscriptionId)
  await completeLedger(plan, primaryCustomerId, primarySubscriptionId, true)
  const report: MigrationResult = {
    ...plan,
    primaryCustomerId,
    primarySubscriptionId,
    outcome: plan.alreadyMigrated ? "already-migrated" : "migrated",
    detail: plan.alreadyMigrated
      ? "migração já estava concluída; reconciliação idempotente sem nova cobrança"
      : "assinatura primary criada, legacy inativada e ponteiros locais atualizados",
  }
  if (args.output) writeFileSync(args.output, JSON.stringify(report, null, 2))
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[migrate-active-legacy-pix-subscription] erro fatal:", error)
  process.exitCode = 1
})
