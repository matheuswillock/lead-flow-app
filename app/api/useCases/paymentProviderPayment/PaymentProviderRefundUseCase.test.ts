import { describe, expect, it, mock } from "bun:test"
import { PaymentProviderRefundUseCase } from "./PaymentProviderRefundUseCase"

const attempt = {
  id: "attempt-1",
  provider: "ABACATE_PAY",
  ownerType: "PLATFORM_PURCHASE",
  ownerId: "purchase-1",
  externalId: "pix_1",
  environment: "PRODUCTION",
  status: "CONFIRMED",
}

function build(overrides: { refund?: () => Promise<unknown>; mirror?: () => Promise<void> } = {}) {
  const mirrorStatus = mock(overrides.mirror ?? (async () => undefined))
  const refund = mock(overrides.refund ?? (async () => ({ status: "REFUNDED" })))
  const useCase = new PaymentProviderRefundUseCase({
    sessions: { findAttemptById: async () => attempt as never },
    refundService: { refund } as never,
    resolveProvider: () => ({ refundFull: async () => undefined }) as never,
    ledgerMirror: { mirrorStatus },
  })
  return { useCase, mirrorStatus, refund }
}

describe("PaymentProviderRefundUseCase: espelho no ledger", () => {
  it("reembolso concluído espelha REFUNDED", async () => {
    const { useCase, mirrorStatus } = build()

    const output = await useCase.execute({ attemptId: "attempt-1" })

    expect(output.isValid).toBe(true)
    expect(mirrorStatus).toHaveBeenCalledWith({
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      externalId: "pix_1",
      status: "REFUNDED",
    })
  })

  it("reembolso que falha não espelha", async () => {
    const consoleError = (await import("bun:test")).spyOn(console, "error").mockImplementation(() => undefined)
    const { useCase, mirrorStatus } = build({
      refund: async () => {
        throw new Error("provider fora")
      },
    })

    const output = await useCase.execute({ attemptId: "attempt-1" })

    expect(output.isValid).toBe(false)
    expect(mirrorStatus).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("falha do espelho não altera o resultado do reembolso", async () => {
    const { useCase } = build({
      mirror: async () => {
        throw new Error("ledger fora")
      },
    })

    const output = await useCase.execute({ attemptId: "attempt-1" })

    expect(output.isValid).toBe(true)
  })
})
