import { describe, expect, it } from "bun:test"
import { hasCustomInstallmentAmounts, readInstallmentLedger } from "./installment-ledger"

describe("installment-ledger", () => {
  it("detecta parcelas com valores distintos", () => {
    const ledger = readInstallmentLedger([
      { index: 0, amount: 1200, paymentSource: "ASAAS", status: "pending" },
      { index: 1, amount: 990, paymentSource: "ASAAS", status: "pending" },
      { index: 2, amount: 990, paymentSource: "ASAAS", status: "pending" },
    ])
    expect(hasCustomInstallmentAmounts(ledger)).toBe(true)
  })

  it("ignora ledger com parcelas iguais", () => {
    const ledger = readInstallmentLedger([
      { index: 0, amount: 100, paymentSource: "ASAAS", status: "pending" },
      { index: 1, amount: 100, paymentSource: "ASAAS", status: "pending" },
    ])
    expect(hasCustomInstallmentAmounts(ledger)).toBe(false)
  })
})
