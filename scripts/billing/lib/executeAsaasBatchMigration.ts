import type { AsaasMigrationSubscription } from "@/app/api/infra/gateways/asaasMigration/IAsaasMigrationGateway"
import type { AsaasBatchMigrationPlanItem } from "./asaasBatchMigrationPlan"

type CustomerPayload = {
  name: string
  email: string
  cpfCnpj?: string
  phone?: string
  externalReference: string
  notificationDisabled: boolean
}

type BatchGateway = {
  findCustomerByExternalReference?(externalReference: string): Promise<{ id: string } | null>
  createCustomer(input: CustomerPayload): Promise<{ id: string }>
  findSubscriptionByExternalReference?(externalReference: string): Promise<AsaasMigrationSubscription | null>
  createSubscription(input: {
    account: "primary"
    customerId: string
    value: number
    cycle: string
    nextDueDate: string
    externalReference: string
    billingType?: string
  }): Promise<AsaasMigrationSubscription>
  listLegacySubscriptionPayments(subscriptionId: string): Promise<Array<{ id: string; status: string }>>
  cancelLegacyPayment(paymentId: string): Promise<boolean>
  findLegacySubscription(subscriptionId: string): Promise<{ id: string; status: string } | null>
  inactivateLegacySubscription(subscriptionId: string): Promise<{ id: string; status: string }>
}

type BatchPersistence = {
  persist(plan: AsaasBatchMigrationPlanItem, primaryCustomerId: string, primarySubscriptionId: string): Promise<void>
  blockAccess(profileId: string, reason: string): Promise<void>
}

export type BatchMigrationExecutionResult = {
  legacySubscriptionId: string
  outcome: "planned" | "migrated" | "already_migrated" | "access_blocked" | "blocked"
  primaryCustomerId?: string
  primarySubscriptionId?: string
  detail: string
}

export async function executeAsaasBatchMigration(input: {
  plans: AsaasBatchMigrationPlanItem[]
  apply: boolean
  gateway: BatchGateway
  persistence: BatchPersistence
  customerProfiles?: Record<string, CustomerPayload>
}): Promise<BatchMigrationExecutionResult[]> {
  const results: BatchMigrationExecutionResult[] = []
  for (const plan of input.plans) {
    if (plan.action === "already_migrated") {
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "already_migrated", primaryCustomerId: plan.primaryCustomerId, primarySubscriptionId: plan.primarySubscriptionId, detail: "assinatura já reconciliada" })
      continue
    }
    if (plan.action === "blocked") {
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "blocked", detail: plan.reason ?? "plano bloqueado" })
      continue
    }
    if (plan.action === "block_access") {
      if (input.apply && plan.profileId) await input.persistence.blockAccess(plan.profileId, plan.reason ?? "inadimplência")
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: input.apply ? "access_blocked" : "planned", detail: plan.reason ?? "acesso bloqueado" })
      continue
    }
    if (!input.apply) {
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "planned", detail: "assinatura primary será criada antes da inativação legacy" })
      continue
    }
    if (!plan.profileId || !plan.value || !plan.cycle || !plan.nextDueDate || !plan.externalReference || !plan.billingType) {
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "blocked", detail: "plano sem dados suficientes para migração" })
      continue
    }

    const customer = plan.primaryCustomerId
      ? { id: plan.primaryCustomerId }
      : await input.gateway.findCustomerByExternalReference?.(plan.profileId)
        ?? await input.gateway.createCustomer(input.customerProfiles?.[plan.profileId] ?? {
          name: plan.profileId,
          email: `${plan.profileId}@invalid.local`,
          externalReference: plan.profileId,
          notificationDisabled: true,
        })
    const existingSubscription = await input.gateway.findSubscriptionByExternalReference?.(plan.externalReference)
    const subscription = existingSubscription ?? await input.gateway.createSubscription({
      account: "primary",
      customerId: customer.id,
      value: plan.value,
      cycle: plan.cycle,
      nextDueDate: plan.nextDueDate,
      externalReference: plan.externalReference,
      billingType: plan.billingType,
    })
    if (subscription.customer !== customer.id || subscription.status !== "ACTIVE" || Math.abs(subscription.value - plan.value) >= 0.005 || subscription.cycle !== plan.cycle) {
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "blocked", primaryCustomerId: customer.id, primarySubscriptionId: subscription.id, detail: "assinatura primary divergente" })
      continue
    }

    const payments = await input.gateway.listLegacySubscriptionPayments(plan.legacySubscriptionId)
    for (const payment of payments.filter((item) => ["PENDING", "OVERDUE"].includes(item.status))) {
      if (!await input.gateway.cancelLegacyPayment(payment.id)) throw new Error(`Cancelamento não confirmado: ${payment.id}`)
    }
    const remaining = await input.gateway.listLegacySubscriptionPayments(plan.legacySubscriptionId)
    if (remaining.some((payment) => ["PENDING", "OVERDUE"].includes(payment.status))) throw new Error("Cobrança legacy ainda pagável")
    const legacySubscription = await input.gateway.findLegacySubscription(plan.legacySubscriptionId)
    if (legacySubscription && legacySubscription.status !== "INACTIVE") await input.gateway.inactivateLegacySubscription(plan.legacySubscriptionId)
    const refreshed = await input.gateway.findLegacySubscription(plan.legacySubscriptionId)
    if (refreshed && refreshed.status !== "INACTIVE") throw new Error("Inativação legacy não confirmada")
    await input.persistence.persist(plan, customer.id, subscription.id)
    results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "migrated", primaryCustomerId: customer.id, primarySubscriptionId: subscription.id, detail: "migração concluída" })
  }
  return results
}
