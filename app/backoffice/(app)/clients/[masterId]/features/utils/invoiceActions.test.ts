import { describe, expect, it } from "bun:test"
import type { BackofficeClientInvoice } from "../context/BackofficeClientDetailsTypes"
import { canCancelInvoice } from "./invoiceActions"

function invoice(overrides: Partial<BackofficeClientInvoice>): BackofficeClientInvoice {
  return {
    id: "inv-1",
    invoiceIdDisplay: "INV-1",
    invoiceName: "Licença",
    invoiceKind: "addon_user",
    source: "asaas",
    status: "PENDING",
    statusGroup: "upcoming",
    value: 100,
    dateCreated: null,
    dueDate: null,
    paymentDate: null,
    description: "",
    billingType: "PIX",
    invoiceUrl: null,
    bankSlipUrl: null,
    invoiceNumber: null,
    checkoutUrl: null,
    pendingActionId: null,
    ...overrides,
  }
}

describe("canCancelInvoice — botão Cancelar da aba Faturas (Fase A3)", () => {
  it("mostra para fatura a vencer e para fatura vencida", () => {
    expect(canCancelInvoice(invoice({ statusGroup: "upcoming" }))).toBe(true)
    expect(canCancelInvoice(invoice({ statusGroup: "overdue" }))).toBe(true)
  })

  it("mostra para ação pendente ainda sem cobrança, mesmo fora dos grupos de vencimento", () => {
    expect(canCancelInvoice(invoice({ source: "pending_action", statusGroup: "other" }))).toBe(true)
  })

  it("não mostra para fatura paga", () => {
    expect(canCancelInvoice(invoice({ statusGroup: "paid" }))).toBe(false)
  })

  it("não mostra para fatura dispensada (WAIVED)", () => {
    expect(canCancelInvoice(invoice({ status: "WAIVED" }))).toBe(false)
  })

  it("não mostra para fatura de adesão externa", () => {
    expect(canCancelInvoice(invoice({ source: "adhesion_external" }))).toBe(false)
  })
})
