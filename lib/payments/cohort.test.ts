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
})
