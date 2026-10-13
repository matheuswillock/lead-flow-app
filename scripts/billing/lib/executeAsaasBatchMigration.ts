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
    const executionPlan = plan.action === "already_migrated" && !plan.migrationConfirmed
      ? { ...plan, action: "migrate" as const }
      : plan

    if (executionPlan.action === "already_migrated") {
      results.push({ legacySubscriptionId: plan.legacySubscriptionId, outcome: "already_migrated", primaryCustomerId: plan.primaryCustomerId, primarySubscriptionId: plan.primarySubscriptionId, detail: "assinatura já reconciliada" })
      continue
    }
    if (executionPlan.action === "blocked") {
      results.push({ legacySubscriptionId: executionPlan.legacySubscriptionId, outcome: "blocked", detail: executionPlan.reason ?? "plano bloqueado" })
      continue
    }
    if (executionPlan.action === "block_access") {
      if (input.apply && executionPlan.profileId) await input.persistence.blockAccess(executionPlan.profileId, executionPlan.reason ?? "inadimplência")
      results.push({ legacySubscriptionId: executionPlan.legacySubscriptionId, outcome: input.apply ? "access_blocked" : "planned", detail: executionPlan.reason ?? "acesso bloqueado" })
      continue
    }
    if (!input.apply) {
      results.push({ legacySubscriptionId: executionPlan.legacySubscriptionId, outcome: "planned", detail: executionPlan.primarySubscriptionId ? "assinatura primary existente será reconciliada antes da inativação legacy" : "assinatura primary será criada antes da inativação legacy" })
      continue
    }
    if (!executionPlan.profileId || !executionPlan.value || !executionPlan.cycle || !executionPlan.nextDueDate || !executionPlan.externalReference || !executionPlan.billingType) {
      results.push({ legacySubscriptionId: executionPlan.legacySubscriptionId, outcome: "blocked", detail: "plano sem dados suficientes para migração" })
      continue
    }

    const customer = executionPlan.primaryCustomerId
      ? { id: executionPlan.primaryCustomerId }
      : await input.gateway.findCustomerByExternalReference?.(executionPlan.profileId)
        ?? await input.gateway.createCustomer(input.customerProfiles?.[executionPlan.profileId] ?? {
          name: executionPlan.profileId,
          email: `${executionPlan.profileId}@invalid.local`,
          externalReference: executionPlan.profileId,
          notificationDisabled: true,
        })
    const existingSubscription = await input.gateway.findSubscriptionByExternalReference?.(executionPlan.externalReference)
    const subscription = existingSubscription ?? await input.gateway.createSubscription({
      account: "primary",
      customerId: customer.id,
      value: executionPlan.value,
      cycle: executionPlan.cycle,
      nextDueDate: executionPlan.nextDueDate,
      externalReference: executionPlan.externalReference,
      billingType: executionPlan.billingType,
    })
    if (subscription.customer !== customer.id || subscription.status !== "ACTIVE" || Math.abs(subscription.value - executionPlan.value) >= 0.005 || subscription.cycle !== executionPlan.cycle) {
      results.push({ legacySubscriptionId: executionPlan.legacySubscriptionId, outcome: "blocked", primaryCustomerId: customer.id, primarySubscriptionId: subscription.id, detail: "assinatura primary divergente" })
      continue
    }

    const payments = await input.gateway.listLegacySubscriptionPayments(executionPlan.legacySubscriptionId)
    for (const payment of payments.filter((item) => ["PENDING", "OVERDUE"].includes(item.status))) {
      if (!await input.gateway.cancelLegacyPayment(payment.id)) throw new Error(`Cancelamento não confirmado: ${payment.id}`)
    }
    const remaining = await input.gateway.listLegacySubscriptionPayments(executionPlan.legacySubscriptionId)
    if (remaining.some((payment) => ["PENDING", "OVERDUE"].includes(payment.status))) throw new Error("Cobrança legacy ainda pagável")
    const legacySubscription = await input.gateway.findLegacySubscription(executionPlan.legacySubscriptionId)
    if (legacySubscription && legacySubscription.status !== "INACTIVE") await input.gateway.inactivateLegacySubscription(executionPlan.legacySubscriptionId)
    const refreshed = await input.gateway.findLegacySubscription(executionPlan.legacySubscriptionId)
    if (refreshed && refreshed.status !== "INACTIVE") throw new Error("Inativação legacy não confirmada")
    await input.persistence.persist(executionPlan, customer.id, subscription.id)
    results.push({ legacySubscriptionId: executionPlan.legacySubscriptionId, outcome: "migrated", primaryCustomerId: customer.id, primarySubscriptionId: subscription.id, detail: "migração concluída" })
  }
  return results
}
