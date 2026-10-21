import { describe, expect, it, mock } from "bun:test"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import type { ProviderWebhookEvent } from "@/lib/payment-provider/types"
import { PaymentEventMismatchError, PaymentEventMatchGuard } from "./paymentEventMatchGuard"

const event = (overrides: Partial<ProviderWebhookEvent> = {}) =>
  ({
    eventId: "evt_1",
    event: "PAYMENT_CONFIRMED",
    environment: "PRODUCTION",
    externalPaymentId: "pay_1",
    status: "CONFIRMED",
    method: "PIX",
    amountInCents: 6990,
    occurredAt: null,
    disputeEpoch: null,
    ...overrides,
  }) as ProviderWebhookEvent

function build() {
  const purchases = {
    findById: mock(async (_id: string): Promise<{ amount: unknown; billingType: string | null } | null> => ({
      amount: "69.90",
      billingType: "PIX",
    })),
  }
  const adhesionPayments = {
    findById: mock(async (_id: string): Promise<{ amountCents: number } | null> => ({ amountCents: 6990 })),
  }
  const gracePayments = {
    findById: mock(async (_id: string): Promise<{ amountCents: number } | null> => ({ amountCents: 6990 })),
  }
  const alert = mock(async (_input: unknown) => undefined)
  const guard = new PaymentEventMatchGuard({ purchases, adhesionPayments, gracePayments, alerter: { alert } })
  return { guard, purchases, adhesionPayments, gracePayments, alert }
}

const owners = [
  PAYMENT_PROVIDER_OWNER_TYPES.PLATFORM_PURCHASE,
  PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_ADHESION,
  PAYMENT_PROVIDER_OWNER_TYPES.BILLING_GRACE_PAYMENT,
] as const
const attemptFor = (ownerType: string) => ({ id: "att-1", ownerType, ownerId: "owner-1" })

describe("PaymentEventMatchGuard (PAY-HARD-T011)", () => {
  describe.each(owners)("dono %s", (ownerType) => {
    it("aceita evento com valor e método iguais ao esperado", async () => {
      const { guard, alert } = build()
      await expect(guard.assertMatches(attemptFor(ownerType), event())).resolves.toBeUndefined()
      expect(alert).not.toHaveBeenCalled()
    })

    it("rejeita valor divergente, audita e alerta", async () => {
      const { guard, alert } = build()
      await expect(guard.assertMatches(attemptFor(ownerType), event({ amountInCents: 100 }))).rejects.toBeInstanceOf(
        PaymentEventMismatchError,
      )
      expect(alert.mock.calls[0]?.[0]).toMatchObject({ key: "payment-event-mismatch", level: "error", slack: true })
    })

    it("rejeita valor ausente em pagamento confirmado (não verificável)", async () => {
      const { guard } = build()
      await expect(guard.assertMatches(attemptFor(ownerType), event({ amountInCents: null }))).rejects.toBeInstanceOf(
        PaymentEventMismatchError,
      )
    })

    it("rejeita método divergente", async () => {
      const { guard } = build()
      await expect(guard.assertMatches(attemptFor(ownerType), event({ method: "CARD" }))).rejects.toBeInstanceOf(
        PaymentEventMismatchError,
      )
    })

    it("rejeita quando o dono não existe (nada a aplicar)", async () => {
      const { guard, purchases, adhesionPayments, gracePayments } = build()
      purchases.findById.mockImplementation(async () => null)
      adhesionPayments.findById.mockImplementation(async () => null)
      gracePayments.findById.mockImplementation(async () => null)
      await expect(guard.assertMatches(attemptFor(ownerType), event())).rejects.toBeInstanceOf(PaymentEventMismatchError)
    })
  })

  it("compra com cartão espera método CARD", async () => {
    const { guard, purchases } = build()
    purchases.findById.mockImplementation(async () => ({ amount: 69.9, billingType: "CREDIT_CARD" }))
    await expect(
      guard.assertMatches(attemptFor("PLATFORM_PURCHASE"), event({ method: "CARD" })),
    ).resolves.toBeUndefined()
    await expect(guard.assertMatches(attemptFor("PLATFORM_PURCHASE"), event({ method: "PIX" }))).rejects.toBeInstanceOf(
      PaymentEventMismatchError,
    )
  })

  it("eventos que não liberam efeito (reembolso, disputa) não passam pela conferência", async () => {
    const { guard, purchases } = build()
    await expect(
      guard.assertMatches(attemptFor("PLATFORM_PURCHASE"), event({ event: "PAYMENT_DISPUTED", amountInCents: null, status: "DISPUTED" })),
    ).resolves.toBeUndefined()
    expect(purchases.findById).not.toHaveBeenCalled()
  })

  it("dono sem esperado conhecido (tipo novo) não é barrado aqui", async () => {
    const { guard } = build()
    await expect(guard.assertMatches(attemptFor("ALGUM_OWNER_NOVO"), event({ amountInCents: 1 }))).resolves.toBeUndefined()
  })
})
