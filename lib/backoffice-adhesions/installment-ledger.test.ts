import { describe, expect, it } from "bun:test"
import {
  buildAdhesionExternalInvoiceId,
  buildExternalInvoiceRowsFromAdhesion,
  hasExternalActivation,
  isAdhesionAccountActivated,
  parseAdhesionExternalInvoiceId,
  readInstallmentLedger,
} from "./installment-ledger"

const williamLedger = [
  {
    index: 0,
    amount: 1200,
    status: "paid",
    paymentSource: "EXTERNAL",
    asaasPaymentId: null,
    paidAt: "2026-07-28T22:40:17.000Z",
  },
  {
    index: 1,
    amount: 990,
    status: "pending",
    paymentSource: "ASAAS",
    asaasPaymentId: "pay_fk2mh67gkzvhztg0",
    paidAt: null,
  },
  {
    index: 2,
    amount: 990,
    status: "pending",
    paymentSource: "ASAAS",
    asaasPaymentId: "pay_f5z855b6mq670wxk",
    paidAt: null,
  },
]

describe("installment-ledger", () => {
  it("normaliza entradas do ledger com índice e valores", () => {
    const ledger = readInstallmentLedger([
      { index: 0, amount: 1200, paymentSource: "ASAAS", status: "pending" },
      { index: 1, amount: 990, paymentSource: "ASAAS", status: "pending" },
      { index: 2, amount: 990, paymentSource: "ASAAS", status: "pending" },
    ])
    expect(ledger).toHaveLength(3)
    expect(ledger[0]?.amount).toBe(1200)
    expect(ledger[2]?.amount).toBe(990)
  })

  it("preserva parcelas pagas com arredondamento distinto na última parcela", () => {
    const ledger = readInstallmentLedger([
      { index: 0, amount: 33.33, paymentSource: "ASAAS", status: "pending" },
      { index: 1, amount: 33.33, paymentSource: "ASAAS", status: "pending" },
      { index: 2, amount: 33.34, paymentSource: "ASAAS", status: "pending" },
    ])
    expect(ledger.map((entry) => entry.amount)).toEqual([33.33, 33.33, 33.34])
  })

  it("detecta ativação por parcela EXTERNAL paga", () => {
    expect(hasExternalActivation(williamLedger)).toBe(true)
    expect(
      hasExternalActivation([{ index: 0, amount: 990, paymentSource: "ASAAS", status: "pending" }])
    ).toBe(false)
  })

  it("considera adesão ativada com conta provisionada ou parcela externa paga", () => {
    expect(
      isAdhesionAccountActivated({
        createdProfileId: "profile-1",
        installmentLedger: williamLedger,
      })
    ).toBe(true)

    expect(
      isAdhesionAccountActivated({
        createdProfileId: null,
        installmentLedger: williamLedger,
      })
    ).toBe(true)

    expect(
      isAdhesionAccountActivated({
        createdProfileId: null,
        installmentLedger: [{ index: 0, amount: 990, paymentSource: "ASAAS", status: "pending" }],
      })
    ).toBe(false)
  })

  it("gera fatura sintética para parcela EXTERNAL paga", () => {
    const adhesionId = "42de0089-2109-405c-b413-4c133132b490"
    const rows = buildExternalInvoiceRowsFromAdhesion({
      id: adhesionId,
      productName: "CRM - Radar",
      installmentLedger: williamLedger,
      paidAt: "2026-07-28T22:40:17.000Z",
      createdAt: "2026-07-28T22:40:00.000Z",
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: buildAdhesionExternalInvoiceId(adhesionId, 0),
      source: "adhesion_external",
      statusGroup: "paid",
      value: 1200,
      billingType: "EXTERNAL",
      description: "Adesão CRM - Radar — Parcela 1 (pago externamente)",
    })
  })

  it("faz parse de IDs de fatura externa do ledger", () => {
    const adhesionId = "42de0089-2109-405c-b413-4c133132b490"
    const invoiceId = buildAdhesionExternalInvoiceId(adhesionId, 0)
    expect(parseAdhesionExternalInvoiceId(invoiceId)).toEqual({
      adhesionId,
      index: 0,
    })
    expect(parseAdhesionExternalInvoiceId("pay_123")).toBeNull()
  })
})
