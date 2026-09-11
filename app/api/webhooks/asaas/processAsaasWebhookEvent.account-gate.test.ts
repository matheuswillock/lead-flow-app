import { beforeEach, describe, expect, it, mock } from "bun:test"

// Achado cursor[bot] (PR #1137, round 10): o gate que decide
// isOperatorPayment/isPendingActionPayment resolvia checkoutSessionId SEM
// filtrar por conta — checkoutSessionId colide entre contas igual paymentId
// (C33). Sem o filtro, um evento da primary podia achar a linha da legacy
// (ou vice-versa), marcando isOperatorPayment=true incorretamente:
// processOperatorCheckoutPaid (que já filtra por conta desde o round 7) não
// achava nada, "Operador pendente não encontrado" era engolido como no-op
// conhecido, e o fallback por externalReference nunca rodava — cliente
// pagou, não recebeu, sem retry.

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
  return new Output(true, ["ok"], [], null)
})

mock.module("@/app/api/useCases/subscriptions/CheckoutAsaasUseCase", () => ({
  checkoutAsaasUseCase: {
    processOperatorCheckoutPaid: processOperatorCheckoutPaidMock,
  },
}))

const confirmPaymentAndCreateOperatorMock = mock(async () => {
  const { Output } = await import("@/lib/output")
  return new Output(true, ["ok"], [], null)
})

mock.module("@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase", () => ({
  subscriptionUpgradeUseCase: {
    confirmPaymentAndCreateOperator: confirmPaymentAndCreateOperatorMock,
  },
}))

const applyPendingActionByPaymentIdMock = mock(async () => {
  const { Output } = await import("@/lib/output")
  return new Output(true, ["ok"], [], null)
})
const applyPendingActionByCheckoutMock = mock(async () => {
  const { Output } = await import("@/lib/output")
  return new Output(true, ["ok"], [], null)
})

mock.module("@/app/api/useCases/pendingActions/PendingActionUseCase", () => ({
  pendingActionUseCase: {
    applyPendingActionByPaymentId: applyPendingActionByPaymentIdMock,
    applyPendingActionByCheckout: applyPendingActionByCheckoutMock,
  },
}))

// Simula uma colisão de checkoutSessionId (C33): a linha só existe na
// conta legacy, não na primary — mesmo checkoutSessionId, contas
// diferentes.
const pendingOperatorFindFirstMock = mock(async (args: any) => {
  if (args?.where?.asaasAccount === "legacy") {
    return { id: "pending-op-1" }
  }
  return null
})
const pendingActionFindFirstMock = mock(async (args: any) => {
  if (args?.where?.asaasAccount === "legacy") {
    return { id: "pa-1" }
  }
  return null
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    pendingOperator: { findFirst: pendingOperatorFindFirstMock },
    pendingAction: { findFirst: pendingActionFindFirstMock },
  },
}))

const { processAsaasWebhookEvent } = await import("./processAsaasWebhookEvent")

describe("processAsaasWebhookEvent — gate de operador/pending action filtra por conta (C33, round 10)", () => {
  beforeEach(() => {
    pendingOperatorFindFirstMock.mockClear()
    pendingActionFindFirstMock.mockClear()
    processOperatorCheckoutPaidMock.mockClear()
    confirmPaymentAndCreateOperatorMock.mockClear()
    applyPendingActionByCheckoutMock.mockClear()
    applyPendingActionByPaymentIdMock.mockClear()
  })

  it("achado cursor[bot] (PR #1137, round 10): checkoutSessionId colide com a legacy, evento é da primary — gate de operador não marca isOperatorPayment, fallback por externalReference roda", async () => {
    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_1",
        status: "CONFIRMED",
        checkoutSession: "checkout_session_colidindo",
        externalReference: "pending-operator-pa-1",
      },
    }

    await processAsaasWebhookEvent(body, "primary")

    expect(pendingOperatorFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ asaasAccount: "primary" }) })
    )
    // gate corretamente NÃO achou a linha (ela é da legacy) — não chama
    // processOperatorCheckoutPaid com a conta errada; deixa o fallback por
    // externalReference (escopado pela conta do evento) rodar.
    expect(processOperatorCheckoutPaidMock).not.toHaveBeenCalled()
    expect(confirmPaymentAndCreateOperatorMock).toHaveBeenCalledTimes(1)
  })

  it("achado cursor[bot] (PR #1137, round 10): mesma colisão para PendingAction — gate não marca isPendingActionPayment, fallback por externalReference roda", async () => {
    const body = {
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_2",
        status: "CONFIRMED",
        checkoutSession: "checkout_session_colidindo_2",
        externalReference: "pending-action-pa-2",
      },
    }

    await processAsaasWebhookEvent(body, "primary")

    expect(pendingActionFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ asaasAccount: "primary" }) })
    )
    expect(applyPendingActionByCheckoutMock).not.toHaveBeenCalled()
    expect(applyPendingActionByPaymentIdMock).toHaveBeenCalledWith("pay_2", "primary")
  })
})
