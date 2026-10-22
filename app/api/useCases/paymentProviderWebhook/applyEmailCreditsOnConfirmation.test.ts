import { describe, expect, it, mock } from "bun:test"
import { ApplyEmailCreditsOnConfirmation } from "./applyEmailCreditsOnConfirmation"

function build(purchase: { id: string; purchaseType: string; productSlug: string } | null) {
  const findById = mock(async (_id: string) => purchase)
  const applyEmailCredits = mock(async (_input: unknown) => ({ handled: true, applied: true, alreadyApplied: false }))
  const alert = mock(async (_input: unknown) => undefined)
  const useCase = new ApplyEmailCreditsOnConfirmation({
    purchases: { findById },
    applyEmailCredits,
    alerter: { alert },
  })
  return { useCase, findById, applyEmailCredits, alert }
}

const creditsPurchase = { id: "purchase-1", purchaseType: "email_credits", productSlug: "email-credits-starter" }

describe("ApplyEmailCreditsOnConfirmation (PAY-HARD-T010)", () => {
  it("aplica os créditos da compra confirmada usando o ID do pagamento como chave de idempotência", async () => {
    const { useCase, applyEmailCredits } = build(creditsPurchase)

    await useCase.apply({ purchaseId: "purchase-1", externalId: "pay_1" })

    expect(applyEmailCredits).toHaveBeenCalledWith({
      paymentId: "pay_1",
      checkoutId: "purchase-1",
      productSlug: "email-credits-starter",
    })
  })

  it("reentrega: a segunda aplicação repassa o mesmo paymentId (o grant impede duplicar) e não falha", async () => {
    const { useCase, applyEmailCredits } = build(creditsPurchase)
    applyEmailCredits.mockImplementationOnce(async () => ({ handled: true, applied: true, alreadyApplied: false }))
    applyEmailCredits.mockImplementationOnce(async () => ({ handled: true, applied: false, alreadyApplied: true }))

    await useCase.apply({ purchaseId: "purchase-1", externalId: "pay_1" })
    await useCase.apply({ purchaseId: "purchase-1", externalId: "pay_1" })

    const paymentIds = applyEmailCredits.mock.calls.map((call) => (call[0] as { paymentId: string }).paymentId)
    expect(paymentIds).toEqual(["pay_1", "pay_1"])
  })

  it("não toca compras que não são de créditos de e-mail", async () => {
    const { useCase, applyEmailCredits } = build({ ...creditsPurchase, purchaseType: "subscription" })

    await useCase.apply({ purchaseId: "purchase-1", externalId: "pay_1" })

    expect(applyEmailCredits).not.toHaveBeenCalled()
  })

  it("falha na aplicação alerta e não derruba o webhook (o cron de reparo reaplica)", async () => {
    const { useCase, applyEmailCredits, alert } = build(creditsPurchase)
    applyEmailCredits.mockImplementationOnce(async () => {
      throw new Error("db fora")
    })

    await expect(useCase.apply({ purchaseId: "purchase-1", externalId: "pay_1" })).resolves.toBeUndefined()

    expect(alert.mock.calls[0]?.[0]).toMatchObject({ key: "email-credits-webhook-apply-failed", level: "error" })
  })
})
