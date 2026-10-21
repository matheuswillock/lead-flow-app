import { describe, expect, it } from "bun:test"
import { PaymentCohortService } from "./PaymentCohortService"

const service = (record: { id: string; paymentCohort: string } | null) =>
  new PaymentCohortService({ subscriptions: { findByProfileId: async () => record } })

describe("PaymentCohortService.resolvePaymentCohort", () => {
  it("usa a coorte gravada na assinatura", async () => {
    expect(await service({ id: "s", paymentCohort: "ROUTER" }).resolvePaymentCohort("p")).toBe("ROUTER")
    expect(await service({ id: "s", paymentCohort: "ASAAS" }).resolvePaymentCohort("p")).toBe("ASAAS")
  })

  it("perfil sem assinatura ou com valor inválido é ASAAS (nada existente muda de comportamento)", async () => {
    expect(await service(null).resolvePaymentCohort("p")).toBe("ASAAS")
    expect(await service({ id: "s", paymentCohort: "???" }).resolvePaymentCohort("p")).toBe("ASAAS")
  })
})
