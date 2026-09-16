import { describe, expect, it } from "bun:test"
import { reconcileInventory } from "./reconcileInventory"
import type { AsaasCustomer, AsaasPayment, AsaasSubscription } from "./asaasInventoryTypes"
import type { DbCustomerPointer, DbSubscriptionPointer } from "./IBillingInventoryRepository"

// ── fixtures — 1 caso de cada classificação do §7.3 (T-30.2) ─────────────

const asaasCustomers: AsaasCustomer[] = [
  { id: "cus_integro", name: "Íntegro", email: "integro@example.com", notificationDisabled: false },
  { id: "cus_fantasma", name: "Fantasma", email: "fantasma@example.com", notificationDisabled: false },
  // cus_orfao NÃO existe aqui de propósito — é o caso ORFAO
]

const asaasSubscriptions: AsaasSubscription[] = [
  {
    id: "sub_integro",
    customer: "cus_integro",
    billingType: "PIX",
    status: "ACTIVE",
    value: 100,
    nextDueDate: "2026-10-01",
    endDate: "2027-01-01",
    cycle: "MONTHLY",
  },
  {
    id: "sub_divergente",
    customer: "cus_integro",
    billingType: "PIX",
    status: "INACTIVE",
    value: 100,
    nextDueDate: "2026-12-20",
    endDate: "2026-12-01", // nextDueDate > endDate → due>fim também aparece aqui
    cycle: "MONTHLY",
  },
  {
    id: "sub_fantasma",
    customer: "cus_integro",
    billingType: "PIX",
    status: "ACTIVE",
    value: 50,
    nextDueDate: "2026-10-05",
    cycle: "MONTHLY",
  },
]

const dbCustomerPointers: DbCustomerPointer[] = [
  { refId: "profile-integro", source: "profile", asaasCustomerId: "cus_integro", email: "integro@example.com" },
  { refId: "adhesion-orfao", source: "adhesion", asaasCustomerId: "cus_orfao", email: "orfao@example.com" },
]

const dbSubscriptionPointers: DbSubscriptionPointer[] = [
  {
    refId: "ps-integro",
    profileId: "profile-integro",
    asaasSubscriptionId: "sub_integro",
    subscriptionStatus: "active",
    subscriptionEndDate: new Date("2027-01-01"),
  },
  {
    refId: "ps-divergente",
    profileId: "profile-integro",
    asaasSubscriptionId: "sub_divergente",
    subscriptionStatus: "active", // banco diz ativo, Asaas diz INACTIVE → divergência
    subscriptionEndDate: new Date("2026-12-01"),
  },
]

const asaasPayments: AsaasPayment[] = [
  {
    id: "pay_1",
    customer: "cus_integro",
    installment: "inst_aberto",
    billingType: "CREDIT_CARD",
    status: "PENDING",
    value: 100,
    dueDate: "2099-01-01", // bem no futuro — nunca vira passado
  },
  {
    id: "pay_2",
    customer: "cus_integro",
    installment: "inst_aberto",
    billingType: "CREDIT_CARD",
    status: "RECEIVED",
    value: 100,
    dueDate: "2020-01-01", // já paga, no passado
  },
  {
    id: "pay_3",
    customer: "cus_integro",
    installment: "inst_fechado",
    billingType: "CREDIT_CARD",
    status: "RECEIVED",
    value: 100,
    dueDate: "2020-02-01",
  },
]

const TODAY = new Date("2026-09-16")

function buildReport(overrides: Partial<Parameters<typeof reconcileInventory>[0]> = {}) {
  return reconcileInventory({
    asaasCustomers,
    asaasSubscriptions,
    asaasPayments,
    dbCustomerPointers,
    dbSubscriptionPointers,
    today: TODAY,
    ...overrides,
  })
}

describe("reconcileInventory — T-30.2", () => {
  it("classifica INTEGRO quando o ponteiro do banco existe e bate no Asaas", () => {
    const report = buildReport()
    const integros = report.cases.filter((c) => c.code === "INTEGRO")
    expect(integros.some((c) => c.asaasId === "cus_integro")).toBe(true)
    expect(integros.some((c) => c.asaasId === "sub_integro")).toBe(true)
  })

  it("classifica ORFAO quando o ponteiro do banco não existe no Asaas", () => {
    const report = buildReport()
    const orfaos = report.cases.filter((c) => c.code === "ORFAO")
    expect(orfaos).toHaveLength(1)
    expect(orfaos[0]?.asaasId).toBe("cus_orfao")
    expect(orfaos[0]?.email).toBe("orfao@example.com")
  })

  it("classifica DIVERGENCIA_STATUS quando o status do banco diverge do Asaas", () => {
    const report = buildReport()
    const divergencias = report.cases.filter((c) => c.code === "DIVERGENCIA_STATUS")
    expect(divergencias).toHaveLength(1)
    expect(divergencias[0]?.asaasId).toBe("sub_divergente")
    expect(divergencias[0]?.detail).toContain("banco=active")
    expect(divergencias[0]?.detail).toContain("Asaas=INACTIVE")
  })

  it("classifica FANTASMA para customer e subscription existentes no Asaas sem ponteiro no banco", () => {
    const report = buildReport()
    const fantasmas = report.cases.filter((c) => c.code === "FANTASMA")
    expect(fantasmas.some((c) => c.asaasId === "cus_fantasma")).toBe(true)
    expect(fantasmas.some((c) => c.asaasId === "sub_fantasma")).toBe(true)
  })

  it("classifica SEM_BANCO para pagante da planilha sem nenhum customer no banco", () => {
    const report = buildReport({
      ownerSpreadsheet: [
        { name: "Já conhecido", email: "integro@example.com" },
        { name: "Leandro Fernandes", email: "leandro@example.com" },
      ],
    })
    const semBanco = report.cases.filter((c) => c.code === "SEM_BANCO")
    expect(semBanco).toHaveLength(1)
    expect(semBanco[0]?.email).toBe("leandro@example.com")
    expect(report.spreadsheetChecked).toBe(true)
  })

  it("spreadsheetChecked é false quando nenhuma planilha é fornecida — nunca finge checar", () => {
    const report = buildReport()
    expect(report.spreadsheetChecked).toBe(false)
    expect(report.cases.some((c) => c.code === "SEM_BANCO")).toBe(false)
  })

  it("marca due > fim (nextDueDate posterior a subscriptionEndDate)", () => {
    const report = buildReport()
    expect(report.dueAfterEnd).toHaveLength(1)
    expect(report.dueAfterEnd[0]?.asaasSubscriptionId).toBe("sub_divergente")
  })

  it("lista installments com parcelas futuras, ignorando os já liquidados", () => {
    const report = buildReport()
    expect(report.openInstallments).toHaveLength(1)
    expect(report.openInstallments[0]?.installmentId).toBe("inst_aberto")
    expect(report.openInstallments[0]?.futureParcelsCount).toBe(1)
    expect(report.openInstallments[0]?.nextDueDate).toBe("2099-01-01")
  })

  it("countsByCode soma exatamente o nº de casos por código — sem perda nem duplicação", () => {
    const report = buildReport({
      ownerSpreadsheet: [{ name: "Leandro Fernandes", email: "leandro@example.com" }],
    })
    const total = Object.values(report.countsByCode).reduce((a, b) => a + b, 0)
    expect(total).toBe(report.cases.length)
    expect(report.countsByCode.INTEGRO).toBeGreaterThan(0)
    expect(report.countsByCode.ORFAO).toBe(1)
    expect(report.countsByCode.DIVERGENCIA_STATUS).toBe(1)
    expect(report.countsByCode.FANTASMA).toBe(2)
    expect(report.countsByCode.SEM_BANCO).toBe(1)
  })
})
