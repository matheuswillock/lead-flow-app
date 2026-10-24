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

describe("mirrorAsaasPaymentToLedger: limite de tempo", () => {
  it("espelho lento não atrasa o retorno além do timeout e registra ledger-mirror-timeout", async () => {
    const log = mock((_message: string, _context: Record<string, unknown>) => undefined)
    const slow = async () =>
      ({ mirrorPayment: () => new Promise<void>((resolve) => setTimeout(resolve, 500)) }) as never

    const startedAt = Date.now()
    await expect(
      mirrorAsaasPaymentToLedger(body, "primary", slow, { timeoutMs: 30, logWarn: log }),
    ).resolves.toBeUndefined()

    expect(Date.now() - startedAt).toBeLessThan(300)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]?.[0]).toBe("[AsaasWebhookRoute][ledger-mirror-timeout]")
    expect(log.mock.calls[0]?.[1]).toMatchObject({ paymentId: "pay_1", timeoutMs: 30 })
  })

  it("espelho rápido não registra timeout", async () => {
    const log = mock((_message: string, _context: Record<string, unknown>) => undefined)
    await mirrorAsaasPaymentToLedger(body, "primary", async () => ({ mirrorPayment: async () => undefined }) as never, {
      timeoutMs: 50,
      logWarn: log,
    })
    expect(log).not.toHaveBeenCalled()
  })
})
