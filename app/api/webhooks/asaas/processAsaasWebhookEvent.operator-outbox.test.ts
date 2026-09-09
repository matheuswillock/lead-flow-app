import { beforeEach, describe, expect, it, mock } from "bun:test"

// T-40.15 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E4): falha não
// idempotente no processamento do checkout de operador pago não pode ficar
// só em Output(false)/console.error — precisa propagar (throw) para que o
// consumer da fila (app/api/queues/asaas-webhook-events/route.ts) marque o
// evento como failed e o cron de retry (já existente) reprocesse.

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
    async processWebhook() {
      const { Output } = await import("@/lib/output")
      return new Output(true, ["ok"], [], { isPaid: true })
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

const processOperatorCheckoutPaidMock = mock(async () => {
  const { Output } = await import("@/lib/output")
  return new Output(false, [], ["Erro ao processar pagamento do operador"], null)
})

mock.module("@/app/api/useCases/subscriptions/CheckoutAsaasUseCase", () => ({
  checkoutAsaasUseCase: {
    processOperatorCheckoutPaid: processOperatorCheckoutPaidMock,
  },
}))

const pendingOperatorFindFirstMock = mock(async () => ({ id: "pending-op-1" }))
const pendingActionFindFirstMock = mock(async () => null)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    pendingOperator: { findFirst: pendingOperatorFindFirstMock },
    pendingAction: { findFirst: pendingActionFindFirstMock },
  },
}))

const { processAsaasWebhookEvent } = await import("./processAsaasWebhookEvent")

describe("processAsaasWebhookEvent — falha do operador não fica só em Output(false) (E4/T-40.15)", () => {
  beforeEach(() => {
    processOperatorCheckoutPaidMock.mockClear()
  })

  it("falha não idempotente propaga (throw) em vez de ser engolida em log", async () => {
    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_1",
        status: "CONFIRMED",
        checkoutSession: "checkout_session_1",
        externalReference: undefined,
      },
    }

    await expect(processAsaasWebhookEvent(body, "primary")).rejects.toThrow()
    expect(processOperatorCheckoutPaidMock).toHaveBeenCalledTimes(1)
  })

  it("controle negativo (via mock): retorno idempotente (já criado) NÃO propaga — resolve normalmente", async () => {
    processOperatorCheckoutPaidMock.mockImplementationOnce(async () => {
      const { Output } = await import("@/lib/output")
      return new Output(false, [], ["Operador já foi criado"], null)
    })

    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_2",
        status: "CONFIRMED",
        checkoutSession: "checkout_session_1",
        externalReference: undefined,
      },
    }

    await expect(processAsaasWebhookEvent(body, "primary")).resolves.toBeUndefined()
  })

  it("achado cursor[bot] (PR #1137, P1): falha PÓS-billing com mensagem diferente da genérica também propaga", async () => {
    // Antes do fix: só a string genérica exata escalava. Uma falha
    // DEPOIS do incremento da assinatura (auth do Supabase, criação de
    // usuário) tinha OUTRA mensagem e nunca era retentada — cliente
    // cobrado, operador nunca entregue, sem sinal.
    processOperatorCheckoutPaidMock.mockImplementationOnce(async () => {
      const { Output } = await import("@/lib/output")
      return new Output(false, [], ["Erro ao conectar com autenticação"], null)
    })

    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_3",
        status: "CONFIRMED",
        checkoutSession: "checkout_session_1",
        externalReference: undefined,
      },
    }

    await expect(processAsaasWebhookEvent(body, "primary")).rejects.toThrow()
  })
})
