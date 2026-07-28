import { describe, expect, it } from "bun:test"
import { readInstallmentLedger } from "./installment-ledger"

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
})
