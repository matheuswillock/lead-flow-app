import { describe, expect, it, mock } from "bun:test"
import { mirrorAsaasPaymentToLedger } from "./mirrorAsaasPaymentToLedger"

const body = { event: "PAYMENT_RECEIVED", payment: { id: "pay_1", status: "RECEIVED" } }

describe("mirrorAsaasPaymentToLedger", () => {
  it("entrega evento, conta e pagamento ao espelho", async () => {
    const mirrorPayment = mock(async (_input: unknown) => undefined)

    await mirrorAsaasPaymentToLedger(body, "legacy", async () => ({ mirrorPayment }) as never)

    expect(mirrorPayment).toHaveBeenCalledWith({ account: "legacy", event: "PAYMENT_RECEIVED", payment: body.payment })
  })

  it("falha ao montar ou executar o espelho nunca propaga (não altera o efeito do webhook)", async () => {
    await expect(
      mirrorAsaasPaymentToLedger(body, "primary", async () => {
        throw new Error("composição quebrou")
      }),
    ).resolves.toBeUndefined()
    await expect(
      mirrorAsaasPaymentToLedger(body, "primary", async () => ({ mirrorPayment: async () => { throw new Error("x") } }) as never),
    ).resolves.toBeUndefined()
  })

  it("evento sem pagamento não chama o espelho", async () => {
    const factory = mock(async () => ({ mirrorPayment: async () => undefined }) as never)

    await mirrorAsaasPaymentToLedger({ event: "SUBSCRIPTION_CREATED" }, "primary", factory)

    expect(factory).not.toHaveBeenCalled()
  })
})
