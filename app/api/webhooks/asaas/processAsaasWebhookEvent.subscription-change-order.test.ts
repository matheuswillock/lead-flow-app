import { beforeEach, describe, expect, it, mock } from "bun:test"

// G3 de [[50 — Backoffice de Cobrança — Backend]] E6: o webhook precisa
// rotear payments com externalReference = subscription-change-order-{id}
// para BackofficeSubscriptionChangeOrderUseCase.applyPaidChangeOrder —
// mesmo padrão de roteamento por prefixo já usado para pending-action-*,
// pending-operator-* e platform-purchase-*.

mock.module("@/lib/cache/invalidation", () => ({
  invalidateAccountAccessStatusCache: () => {},
}))

mock.module("@/app/api/infra/data/repositories/payment/PaymentRepository", () => ({
  PaymentRepository: class {},
}))

mock.module("@/app/api/services/PaymentValidation/PaymentValidationService", () => ({
  PaymentValidationService: class {
    async processWebhook() {
      return { success: true, isPaid: true, message: "ok" }
    }
  },
}))

mock.module("@/app/api/useCases/payments/PaymentValidationUseCase", () => ({
  PaymentValidationUseCase: class {
    async processWebhook(input: { payment?: { status?: string } }) {
      const { Output } = await import("@/lib/output")
      const isPaid = input.payment?.status === "RECEIVED" || input.payment?.status === "CONFIRMED"
      return new Output(true, ["ok"], [], { isPaid })
    }
  },
}))

mock.module("@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase", () => ({
  backofficeAdhesionUseCase: {
    processPaymentWebhook: async () => {
      const { Output } = await import("@/lib/output")
      return new Output(true, [], [], null)
    },
  },
}))

mock.module("@/app/api/infra/data/repositories/backoffice/PaymentRepository/BackofficePaymentRepository", () => ({
  BackofficePaymentRepository: class {
    async findByAsaasPaymentId() {
      return null
    }
  },
}))

const applyPaidChangeOrderMock = mock(async () => {
  const { Output } = await import("@/lib/output")
  return new Output(true, ["Ordem aplicada com sucesso"], [], { id: "order-1" })
})

mock.module("@/app/api/useCases/backoffice/BackofficeSubscriptionChangeOrderUseCase", () => ({
  backofficeSubscriptionChangeOrderUseCase: {
    applyPaidChangeOrder: applyPaidChangeOrderMock,
  },
}))

const { processAsaasWebhookEvent } = await import("./processAsaasWebhookEvent")

describe("processAsaasWebhookEvent — roteia subscription-change-order-* (G3)", () => {
  beforeEach(() => {
    applyPaidChangeOrderMock.mockClear()
  })

  it("PAYMENT_CONFIRMED com externalReference de ordem → chama applyPaidChangeOrder com payment/conta do evento", async () => {
    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_new_1",
        status: "CONFIRMED",
        externalReference: "subscription-change-order-order-1",
      },
    }

    await processAsaasWebhookEvent(body, "primary")

    expect(applyPaidChangeOrderMock).toHaveBeenCalledWith({
      externalReference: "subscription-change-order-order-1",
      asaasPaymentId: "pay_new_1",
      account: "primary",
    })
  })

  it("externalReference de outro domínio (pending-action-*) → NÃO chama applyPaidChangeOrder", async () => {
    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_2",
        status: "CONFIRMED",
        externalReference: "pending-action-xyz",
      },
    }

    await processAsaasWebhookEvent(body, "primary")

    expect(applyPaidChangeOrderMock).not.toHaveBeenCalled()
  })

  it("payment ainda não confirmado (PENDING) → NÃO chama applyPaidChangeOrder", async () => {
    const body = {
      event: "PAYMENT_CREATED",
      payment: {
        id: "pay_3",
        status: "PENDING",
        externalReference: "subscription-change-order-order-1",
      },
    }

    await processAsaasWebhookEvent(body, "primary")

    expect(applyPaidChangeOrderMock).not.toHaveBeenCalled()
  })

  it("falha de applyPaidChangeOrder não derruba o processamento do evento (só loga)", async () => {
    applyPaidChangeOrderMock.mockResolvedValueOnce(
      (async () => {
        const { Output } = await import("@/lib/output")
        return new Output(false, [], ["Evento de pagamento não corresponde à cobrança desta ordem"], null)
      })() as never
    )

    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_4",
        status: "CONFIRMED",
        externalReference: "subscription-change-order-order-1",
      },
    }

    await expect(processAsaasWebhookEvent(body, "primary")).resolves.toBeUndefined()
  })
})
