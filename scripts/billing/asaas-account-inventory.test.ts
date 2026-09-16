import { describe, expect, it } from "bun:test"
import {
  buildDefaultOutputFilename,
  buildInventoryReport,
  dedupePaymentsById,
  parseInventoryArgs,
  summarizeCustomers,
  summarizePayments,
  summarizeSubscriptions,
  summarizeWebhooks,
} from "./lib/asaasAccountInventoryLogic"
import type { AsaasCustomer, AsaasPayment, AsaasSubscription, AsaasWebhookConfig } from "./lib/asaasInventoryTypes"

describe("parseInventoryArgs", () => {
  it("default: account=legacy, reconcile=false, sem output/spreadsheet", () => {
    const args = parseInventoryArgs([])
    expect(args).toEqual({ account: "legacy", reconcile: false, output: undefined, spreadsheet: undefined })
  })

  it("--account=primary muda a conta; qualquer outro valor cai em legacy", () => {
    expect(parseInventoryArgs(["--account=primary"]).account).toBe("primary")
    expect(parseInventoryArgs(["--account=lixo"]).account).toBe("legacy")
  })

  it("--reconcile, --output e --spreadsheet são lidos", () => {
    const args = parseInventoryArgs([
      "--reconcile",
      "--output=inventory.json",
      "--spreadsheet=planilha.json",
    ])
    expect(args.reconcile).toBe(true)
    expect(args.output).toBe("inventory.json")
    expect(args.spreadsheet).toBe("planilha.json")
  })
})

describe("buildDefaultOutputFilename", () => {
  it("gera nome com conta e data ISO (dump versionado, C34)", () => {
    const name = buildDefaultOutputFilename("legacy", new Date("2026-09-16T12:00:00Z"))
    expect(name).toBe("asaas-inventory-legacy-2026-09-16.json")
  })

  it("conta primary também aparece no nome", () => {
    const name = buildDefaultOutputFilename("primary", new Date("2026-01-05T00:00:00Z"))
    expect(name).toBe("asaas-inventory-primary-2026-01-05.json")
  })
})

describe("summarizeCustomers", () => {
  const customers: AsaasCustomer[] = [
    { id: "c1", name: "A", email: "a@x.com", notificationDisabled: false, externalReference: "profile-1" },
    { id: "c2", name: "B", email: "b@x.com", notificationDisabled: true },
    { id: "c3", name: "C", email: "c@x.com", notificationDisabled: true, externalReference: "profile-3" },
  ]

  it("conta notificações ligadas/desligadas e externalReference presente/ausente", () => {
    const summary = summarizeCustomers(customers)
    expect(summary.total).toBe(3)
    expect(summary.withNotificationsEnabled).toBe(1)
    expect(summary.withNotificationsDisabled).toBe(2)
    expect(summary.withExternalReference).toBe(2)
    expect(summary.withoutExternalReference).toBe(1)
    expect(summary.data).toBe(customers)
  })
})

describe("summarizeSubscriptions", () => {
  const subs: AsaasSubscription[] = [
    { id: "s1", customer: "c1", billingType: "CREDIT_CARD", status: "ACTIVE", value: 100, nextDueDate: "2026-10-01", cycle: "MONTHLY" },
    { id: "s2", customer: "c2", billingType: "PIX", status: "ACTIVE", value: 50, nextDueDate: "2026-10-05", cycle: "QUARTERLY" },
    { id: "s3", customer: "c3", billingType: "CREDIT_CARD", status: "INACTIVE", value: 80, nextDueDate: "2026-11-01", cycle: "MONTHLY" },
  ]

  it("agrega por status/ciclo/tipo de cobrança e conta cartão de crédito", () => {
    const summary = summarizeSubscriptions(subs)
    expect(summary.total).toBe(3)
    expect(summary.byStatus).toEqual({ ACTIVE: 2, INACTIVE: 1 })
    expect(summary.byCycle).toEqual({ MONTHLY: 2, QUARTERLY: 1 })
    expect(summary.byBillingType).toEqual({ CREDIT_CARD: 2, PIX: 1 })
    expect(summary.creditCardCount).toBe(2)
  })

  it("creditCardCount é 0 quando não há nenhuma assinatura de cartão", () => {
    const summary = summarizeSubscriptions([subs[1]!])
    expect(summary.creditCardCount).toBe(0)
  })
})

describe("summarizePayments", () => {
  it("soma o valor total arredondado em centavos", () => {
    const payments: AsaasPayment[] = [
      { id: "p1", customer: "c1", billingType: "PIX", status: "PENDING", value: 10.005, dueDate: "2026-10-01" },
      { id: "p2", customer: "c2", billingType: "PIX", status: "PENDING", value: 20.001, dueDate: "2026-10-02" },
    ]
    const summary = summarizePayments(payments)
    expect(summary.total).toBe(2)
    expect(summary.totalValue).toBe(30.01)
  })
})

describe("summarizeWebhooks", () => {
  it("conta quantos webhooks estão habilitados", () => {
    const webhooks: AsaasWebhookConfig[] = [
      { id: "w1", url: "https://a", enabled: true, events: ["PAYMENT_CONFIRMED"] },
      { id: "w2", url: "https://b", enabled: false, events: [] },
    ]
    const summary = summarizeWebhooks(webhooks)
    expect(summary.total).toBe(2)
    expect(summary.enabled).toBe(1)
  })

  it("REDIGE o authToken — o segredo nunca entra no relatório serializado", () => {
    const webhooks: AsaasWebhookConfig[] = [
      { id: "w1", url: "https://a", enabled: true, events: [], authToken: "segredo-vivo" },
      { id: "w2", url: "https://b", enabled: false, events: [] },
    ]
    const summary = summarizeWebhooks(webhooks)

    expect(summary.data[0]?.hasAuthToken).toBe(true)
    expect(summary.data[1]?.hasAuthToken).toBe(false)
    for (const entry of summary.data) {
      expect("authToken" in entry).toBe(false)
    }
    // O que vai para o dump é o JSON — prova no formato final:
    expect(JSON.stringify(summary)).not.toContain("segredo-vivo")
  })
})

describe("dedupePaymentsById", () => {
  it("une listas sem duplicar quando a mesma cobrança aparece em mais de uma query", () => {
    const shared: AsaasPayment = { id: "p1", customer: "c1", billingType: "PIX", status: "PENDING", value: 10, dueDate: "2026-10-01" }
    const onlyOverdue: AsaasPayment = { id: "p2", customer: "c1", billingType: "PIX", status: "OVERDUE", value: 5, dueDate: "2026-08-01" }
    const merged = dedupePaymentsById([shared], [shared, onlyOverdue])
    expect(merged).toHaveLength(2)
    expect(merged.map((p) => p.id).sort()).toEqual(["p1", "p2"])
  })
})

describe("buildInventoryReport", () => {
  it("monta o relatório com generatedAt e reconciliação opcional", () => {
    const report = buildInventoryReport({
      account: "legacy",
      customers: [],
      subscriptions: [],
      pendingPayments: [],
      overduePayments: [],
      creditCardPayments: [],
      webhooks: [],
      generatedAt: new Date("2026-09-16T00:00:00Z"),
    })
    expect(report.account).toBe("legacy")
    expect(report.generatedAt).toBe("2026-09-16T00:00:00.000Z")
    expect(report.reconciliation).toBeUndefined()
  })

  it("propaga a reconciliação quando fornecida", () => {
    const reconciliation = {
      ran: true as const,
      cases: [],
      countsByCode: { INTEGRO: 0, ORFAO: 0, DIVERGENCIA_STATUS: 0, FANTASMA: 0, SEM_BANCO: 0 },
      dueAfterEnd: [],
      openInstallments: [],
      spreadsheetChecked: false,
    }
    const report = buildInventoryReport({
      account: "primary",
      customers: [],
      subscriptions: [],
      pendingPayments: [],
      overduePayments: [],
      creditCardPayments: [],
      webhooks: [],
      reconciliation,
    })
    expect(report.reconciliation).toBe(reconciliation)
  })
})
