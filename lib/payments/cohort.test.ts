import { describe, expect, it } from "bun:test"
import { cohortForPaidAdhesion, resolveCohortFromSubscription } from "./cohort"

describe("resolveCohortFromSubscription", () => {
  it("assinatura inexistente ou valor desconhecido cai em ASAAS (fail-safe)", () => {
    expect(resolveCohortFromSubscription(null)).toBe("ASAAS")
    expect(resolveCohortFromSubscription({ paymentCohort: "OUTRA" })).toBe("ASAAS")
    expect(resolveCohortFromSubscription({ paymentCohort: undefined })).toBe("ASAAS")
  })

  it("respeita a coorte gravada", () => {
    expect(resolveCohortFromSubscription({ paymentCohort: "ROUTER" })).toBe("ROUTER")
    expect(resolveCohortFromSubscription({ paymentCohort: "ASAAS" })).toBe("ASAAS")
  })
})

describe("cohortForPaidAdhesion", () => {
  it("adesão sem cobrança Asaas real é ROUTER", () => {
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: null })).toBe("ROUTER")
    expect(cohortForPaidAdhesion({ billingType: "EXTERNAL", asaasPaymentId: null })).toBe("ROUTER")
  })

  it("adesão com cobrança Asaas continua ASAAS", () => {
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: "pay_123" })).toBe("ASAAS")
  })

  it("adesão só com parcelas ASAAS no ledger (sem asaasPaymentId) é ASAAS, pendente ou paga pelo Asaas", () => {
    const pending = [{ index: 0, amount: 100, paymentSource: "ASAAS", status: "pending", asaasPaymentId: "pay_1" }]
    const paid = [{ index: 0, amount: 100, paymentSource: "ASAAS", status: "paid", asaasPaymentId: "pay_1" }]
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: null, installmentLedger: pending })).toBe("ASAAS")
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: null, installmentLedger: paid })).toBe("ASAAS")
  })

  it("adesão do Abacate (ledger vazio, ou parcelas pagas por fora/sem cobrança Asaas) é ROUTER", () => {
    const external = [{ index: 0, amount: 100, paymentSource: "EXTERNAL", status: "paid", asaasPaymentId: null }]
    const paidWithoutAsaasCharge = [{ index: 0, amount: 100, paymentSource: "ASAAS", status: "paid", asaasPaymentId: null }]
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: null, installmentLedger: [] })).toBe("ROUTER")
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: null, installmentLedger: external })).toBe("ROUTER")
    expect(cohortForPaidAdhesion({ billingType: "PIX", asaasPaymentId: null, installmentLedger: paidWithoutAsaasCharge })).toBe(
      "ROUTER",
    )
  })

  it("EXTERNAL é sempre ROUTER, mesmo com parcelas ASAAS no ledger", () => {
    const pending = [{ index: 0, amount: 100, paymentSource: "ASAAS", status: "pending", asaasPaymentId: "pay_1" }]
    expect(cohortForPaidAdhesion({ billingType: "EXTERNAL", asaasPaymentId: null, installmentLedger: pending })).toBe("ROUTER")
  })
})
