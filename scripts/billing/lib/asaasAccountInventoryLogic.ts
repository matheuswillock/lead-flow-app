/**
 * Lógica pura do inventário 30-E1 — sem I/O, sem `process.env`, sem
 * `fetch`. Separado do CLI (`../asaas-account-inventory.ts`) para ser
 * importável em teste sem disparar rede, Prisma ou `main()`.
 */

import type { AsaasAccountId } from "@/lib/asaas/asaas-account"
import type { AsaasCustomer, AsaasPayment, AsaasSubscription, AsaasWebhookConfig } from "./asaasInventoryTypes"
import type { ReconciliationReport } from "./reconcileInventory"

export type InventoryArgs = {
  account: AsaasAccountId
  reconcile: boolean
  output?: string
  spreadsheet?: string
}

export function parseInventoryArgs(argv: string[]): InventoryArgs {
  const accountArg = argv.find((a) => a.startsWith("--account="))?.split("=")[1]
  const account: AsaasAccountId = accountArg === "primary" ? "primary" : "legacy"

  return {
    account,
    reconcile: argv.includes("--reconcile"),
    output: argv.find((a) => a.startsWith("--output="))?.split("=")[1],
    spreadsheet: argv.find((a) => a.startsWith("--spreadsheet="))?.split("=")[1],
  }
}

/** Nome sugerido para o dump versionado do dia (C34) — YYYY-MM-DD, UTC. */
export function buildDefaultOutputFilename(account: AsaasAccountId, date: Date): string {
  const iso = date.toISOString().slice(0, 10)
  return `asaas-inventory-${account}-${iso}.json`
}

export type CustomerSummary = {
  total: number
  withNotificationsEnabled: number
  withNotificationsDisabled: number
  withExternalReference: number
  withoutExternalReference: number
  data: AsaasCustomer[]
}

export function summarizeCustomers(customers: AsaasCustomer[]): CustomerSummary {
  return {
    total: customers.length,
    withNotificationsEnabled: customers.filter((c) => !c.notificationDisabled).length,
    withNotificationsDisabled: customers.filter((c) => c.notificationDisabled).length,
    withExternalReference: customers.filter((c) => !!c.externalReference).length,
    withoutExternalReference: customers.filter((c) => !c.externalReference).length,
    data: customers,
  }
}

export type SubscriptionSummary = {
  total: number
  byStatus: Record<string, number>
  byCycle: Record<string, number>
  byBillingType: Record<string, number>
  creditCardCount: number
  data: AsaasSubscription[]
}

function buildCountMap<T extends Record<string, unknown>>(items: T[], key: keyof T): Record<string, number> {
  const map: Record<string, number> = {}
  for (const item of items) {
    const value = String(item[key] ?? "unknown")
    map[value] = (map[value] ?? 0) + 1
  }
  return map
}

export function summarizeSubscriptions(subscriptions: AsaasSubscription[]): SubscriptionSummary {
  const byBillingType = buildCountMap(subscriptions, "billingType")
  return {
    total: subscriptions.length,
    byStatus: buildCountMap(subscriptions, "status"),
    byCycle: buildCountMap(subscriptions, "cycle"),
    byBillingType,
    creditCardCount: byBillingType.CREDIT_CARD ?? 0,
    data: subscriptions,
  }
}

export type PaymentSummary = {
  total: number
  totalValue: number
  data: AsaasPayment[]
}

export function summarizePayments(payments: AsaasPayment[]): PaymentSummary {
  const totalValue = payments.reduce((sum, p) => sum + p.value, 0)
  return {
    total: payments.length,
    totalValue: Math.round(totalValue * 100) / 100,
    data: payments,
  }
}

/**
 * Shape do webhook no relatório: `authToken` NUNCA entra — o relatório vai
 * para stdout/arquivo versionado (dump C34) e um token de webhook vivo em
 * repositório é vazamento de credencial (achado cursor/Codex no PR #1189).
 * Só o fato "tem token configurado" é preservado.
 */
export type RedactedAsaasWebhookConfig = Omit<AsaasWebhookConfig, "authToken"> & {
  hasAuthToken: boolean
}

export type WebhookSummary = {
  total: number
  enabled: number
  data: RedactedAsaasWebhookConfig[]
}

export function summarizeWebhooks(webhooks: AsaasWebhookConfig[]): WebhookSummary {
  return {
    total: webhooks.length,
    enabled: webhooks.filter((w) => w.enabled).length,
    data: webhooks.map(({ authToken, ...rest }) => ({
      ...rest,
      hasAuthToken: Boolean(authToken),
    })),
  }
}

/** Une listas de payments por id, sem duplicar quando a mesma cobrança aparece em mais de uma query (PENDING/OVERDUE/CREDIT_CARD podem se sobrepor). */
export function dedupePaymentsById(...lists: AsaasPayment[][]): AsaasPayment[] {
  const byId = new Map<string, AsaasPayment>()
  for (const list of lists) {
    for (const payment of list) {
      byId.set(payment.id, payment)
    }
  }
  return [...byId.values()]
}

export type InventoryReport = {
  account: AsaasAccountId
  generatedAt: string
  customers: CustomerSummary
  subscriptions: SubscriptionSummary
  pendingPayments: PaymentSummary
  overduePayments: PaymentSummary
  creditCardPayments: PaymentSummary
  webhooks: WebhookSummary
  reconciliation?: ReconciliationReport
}

export function buildInventoryReport(input: {
  account: AsaasAccountId
  customers: AsaasCustomer[]
  subscriptions: AsaasSubscription[]
  pendingPayments: AsaasPayment[]
  overduePayments: AsaasPayment[]
  creditCardPayments: AsaasPayment[]
  webhooks: AsaasWebhookConfig[]
  reconciliation?: ReconciliationReport
  generatedAt?: Date
}): InventoryReport {
  const generatedAt = input.generatedAt ?? new Date()
  return {
    account: input.account,
    generatedAt: generatedAt.toISOString(),
    customers: summarizeCustomers(input.customers),
    subscriptions: summarizeSubscriptions(input.subscriptions),
    pendingPayments: summarizePayments(input.pendingPayments),
    overduePayments: summarizePayments(input.overduePayments),
    creditCardPayments: summarizePayments(input.creditCardPayments),
    webhooks: summarizeWebhooks(input.webhooks),
    reconciliation: input.reconciliation,
  }
}
