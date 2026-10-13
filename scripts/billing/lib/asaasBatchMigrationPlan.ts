import type { AsaasCustomer, AsaasSubscription } from "./asaasInventoryTypes"

type PrimarySubscription = Pick<AsaasSubscription, "id" | "customer" | "externalReference">

export type AsaasBatchMigrationPlanInput = {
  legacyCustomers: AsaasCustomer[]
  legacySubscriptions: AsaasSubscription[]
  primaryCustomers: AsaasCustomer[]
  primarySubscriptions?: PrimarySubscription[]
  profileByLegacyCustomerId: Record<string, string>
}

export type AsaasBatchMigrationPlanItem = {
  action: "migrate" | "already_migrated" | "block_access" | "blocked"
  legacyCustomerId: string
  legacySubscriptionId: string
  profileId?: string
  primaryCustomerId?: string
  primarySubscriptionId?: string
  billingType?: string
  cycle?: string
  value?: number
  nextDueDate?: string
  externalReference?: string
  reason?:
    | "credit_card_requires_manual_block"
    | "owner_not_reconciled"
    | "primary_customer_not_found"
    | "primary_customer_to_create"
    | "unsupported_billing_type"
}

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ""
}

function uniqueMatch<T>(items: T[], predicate: (item: T) => boolean): T | null {
  const matches = items.filter(predicate)
  return matches.length === 1 ? matches[0]! : null
}

function findPrimaryCustomer(
  legacyCustomer: AsaasCustomer,
  profileId: string,
  primaryCustomers: AsaasCustomer[],
): AsaasCustomer | null {
  return uniqueMatch(primaryCustomers, (customer) => customer.externalReference === profileId)
    ?? uniqueMatch(primaryCustomers, (customer) => normalized(customer.email) === normalized(legacyCustomer.email))
    ?? uniqueMatch(primaryCustomers, (customer) => Boolean(legacyCustomer.cpfCnpj) && customer.cpfCnpj === legacyCustomer.cpfCnpj)
}

function toExternalReference(subscriptionId: string): string {
  return `asaas-migration:batch:${subscriptionId}`
}

export function buildAsaasBatchMigrationPlan(input: AsaasBatchMigrationPlanInput): AsaasBatchMigrationPlanItem[] {
  const customerById = new Map(input.legacyCustomers.map((customer) => [customer.id, customer]))
  const primarySubscriptions = input.primarySubscriptions ?? []
  const activeSubscriptions = input.legacySubscriptions.filter((subscription) => subscription.status === "ACTIVE")
  const seenSubscriptions = new Set<string>()

  return activeSubscriptions.flatMap((subscription): AsaasBatchMigrationPlanItem[] => {
    if (seenSubscriptions.has(subscription.id)) return []
    seenSubscriptions.add(subscription.id)

    const legacyCustomer = customerById.get(subscription.customer)
    const profileId = input.profileByLegacyCustomerId[subscription.customer]
    if (!legacyCustomer || !profileId) {
      return [{ action: "blocked", legacyCustomerId: subscription.customer, legacySubscriptionId: subscription.id, reason: "owner_not_reconciled" }]
    }

    const externalReference = toExternalReference(subscription.id)
  const primaryCustomer = findPrimaryCustomer(legacyCustomer, profileId, input.primaryCustomers)
    const possiblePrimaryMatches = input.primaryCustomers.filter((customer) =>
      customer.externalReference === profileId
      || normalized(customer.email) === normalized(legacyCustomer.email)
      || (Boolean(legacyCustomer.cpfCnpj) && customer.cpfCnpj === legacyCustomer.cpfCnpj),
    )
    if (!primaryCustomer && possiblePrimaryMatches.length > 0) {
      return [{ action: "blocked", legacyCustomerId: subscription.customer, legacySubscriptionId: subscription.id, profileId, reason: "primary_customer_not_found" }]
    }

    const primarySubscription = primarySubscriptions.find((candidate) => candidate.externalReference === externalReference)
    const base = {
      legacyCustomerId: subscription.customer,
      legacySubscriptionId: subscription.id,
      profileId,
      primaryCustomerId: primaryCustomer?.id,
      primarySubscriptionId: primarySubscription?.id,
      billingType: subscription.billingType,
      cycle: subscription.cycle,
      value: subscription.value,
      nextDueDate: subscription.nextDueDate,
      externalReference,
    }

    if (primarySubscription) return [{ ...base, action: "already_migrated" }]
    if (subscription.billingType === "CREDIT_CARD") return [{ ...base, action: "block_access", reason: "credit_card_requires_manual_block" }]
    if (!["PIX", "BOLETO"].includes(subscription.billingType)) return [{ ...base, action: "blocked", reason: "unsupported_billing_type" }]
    return [{ ...base, action: "migrate", ...(primaryCustomer ? {} : { reason: "primary_customer_to_create" as const }) }]
  })
}
