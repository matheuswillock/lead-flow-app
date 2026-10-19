import { describe, expect, it, mock, spyOn } from "bun:test"
import type { PaymentProviderPaymentServiceDependencies } from "./PaymentProviderPaymentService"
import { PaymentProviderPaymentService } from "./PaymentProviderPaymentService"
import type { PaymentAttemptStatus, ProviderPixInstructions } from "@/lib/payment-provider/types"

type AttemptOverrides = Partial<{
  id: string
  sessionId: string
  status: PaymentAttemptStatus
  externalId: string | null
  paymentInstructions: ProviderPixInstructions | null
}>

function makeAttempt(overrides: AttemptOverrides = {}) {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    attemptNumber: 1,
    idempotencyKey: "idem-1",
    requestFingerprint: "fingerprint",
    provider: "ABACATE_PAY" as const,
    environment: "DEV" as const,
    externalAccountContext: "abacate-dev",
    tenantId: "team-1",
    ownerType: "PLATFORM_PURCHASE",
    ownerId: "purchase-1",
    status: "CREATED" as PaymentAttemptStatus,
    externalId: null,
    unknownReason: null,
    paymentInstructions: null,
    lease: { leaseToken: null, leaseUntil: null, fenceVersion: 0 },
    ...overrides,
  }
}

function makeDependencies(
  outcome: unknown,
  attemptOverrides: AttemptOverrides = {},
  providerInitError?: Error,
) {
  const attempt = makeAttempt(attemptOverrides)
  const updatedAttempt = makeAttempt({ status: "PENDING", externalId: "pay_1" })
  const dependencies: PaymentProviderPaymentServiceDependencies = {
    purchases: {
      findById: mock(
        async () =>
          ({
            id: "purchase-1",
            profileId: "profile-1",
            teamId: "team-1",
            status: "pending",
            billingType: "PIX",
            amount: "49.90",
            externalReference: "purchase:purchase-1",
            productSlug: "email",
          }) as never,
      ),
      markPaidOnceForProvider: mock(async () => null),
    },
    profiles: {
      findBySupabaseId: mock(async () => ({ id: "profile-1" }) as never),
    },
    router: {
      select: mock(async () => ({
        provider: "ABACATE_PAY" as const,
        environment: "DEV" as const,
        enabled: true,
        isDefault: true,
        rolloutState: "ACTIVE" as const,
        killSwitch: false,
        externalAccountContext: "abacate-dev",
        revision: 1,
        healthStatus: "HEALTHY" as const,
      })),
    },
    sessions: {
      createSession: mock(async () => ({
        id: "session-1",
        tenantId: "team-1",
        ownerType: "PLATFORM_PURCHASE",
        ownerId: "purchase-1",
        idempotencyKey: "idem-1",
        provider: "ABACATE_PAY" as const,
        environment: "DEV" as const,
        externalAccountContext: "abacate-dev",
        route: "NEW_ROUTER" as const,
        routeVersion: "PAY-PROV-PHASE-3",
        status: "OPEN" as const,
        expiresAt: new Date("2026-10-18T12:30:00.000Z"),
        lease: { leaseToken: null, leaseUntil: null, fenceVersion: 0 },
      })),
      createAttempt: mock(async () => attempt),
      acquireAttemptLease: mock(async () => ({
        ...attempt,
        lease: {
          leaseToken: "lease-1",
          leaseUntil: new Date("2026-10-18T12:01:00.000Z"),
          fenceVersion: 1,
        },
      })),
      updateAttemptWithLease: mock(async () => updatedAttempt),
      findAttemptByExternalId: mock(async () => null),
      applyEventWithClaim: mock(async () => updatedAttempt),
      findAttemptById: mock(async () => null),
      listAttempts: mock(async () => []),
      listAttemptsPendingReconciliation: mock(async () => []),
      listAttemptsPendingEmailCreditEntitlements: mock(async () => []),
      releaseAttemptLease: mock(async () => undefined),
    },
    identities: {
      bind: mock(async (binding) => ({ id: "identity-1", bindingRevision: 1, ...binding })),
      find: mock(async () => null),
    },
    resolveProvider: mock(
      () =>
        ({
          createPixPayment: mock(async () => {
            if (providerInitError) throw providerInitError
            return outcome
          }),
          createCardPayment: mock(async () => {
            if (providerInitError) throw providerInitError
            return outcome
          }),
        }) as never,
    ),
    environment: "DEV",
    now: () => new Date("2026-10-18T12:00:00.000Z"),
  }
  return dependencies
}

describe("PaymentProviderPaymentService", () => {
  it("routes a PIX payment, leases the attempt, and returns only safe provider data", async () => {
    const dependencies = makeDependencies({
      status: "PENDING",
      externalId: "pay_1",
      method: "PIX",
      amountInCents: 4990,
      currency: "BRL",
      pix: {
        brCode: "000201",
        brCodeBase64: "base64",
        expiresAt: "2026-10-18T13:00:00.000Z",
      },
    })
    const service = new PaymentProviderPaymentService(dependencies)

    const result = await service.startPayment({
      purchaseId: "purchase-1",
      supabaseId: "supabase-1",
      idempotencyKey: "idem-1",
      method: "PIX",
      customer: { name: "Cliente", email: "cliente@example.com", taxId: "123", cellphone: "999" },
    })

    expect(result).toMatchObject({
      sessionId: "session-1",
      attemptId: "attempt-1",
      status: "PENDING",
      externalId: "pay_1",
      amountInCents: 4990,
      method: "PIX",
      purchaseStatus: "pending",
      pix: { brCode: "000201" },
    })
    expect(dependencies.sessions.acquireAttemptLease).toHaveBeenCalledTimes(1)
    expect(dependencies.sessions.updateAttemptWithLease).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentInstructions: {
          brCode: "000201",
          brCodeBase64: "base64",
          expiresAt: "2026-10-18T13:00:00.000Z",
        },
      }),
    )
    expect(dependencies.identities.bind).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: "pay_1", identityType: "PAYMENT" }),
    )
  })

  it("persists UNKNOWN without retrying or exposing card data", async () => {
    const dependencies = makeDependencies({
      status: "UNKNOWN",
      externalId: null,
      reason: "REMOTE_TIMEOUT",
      requiresReconciliation: true,
    })
    const service = new PaymentProviderPaymentService(dependencies)

    const result = await service.startPayment({
      purchaseId: "purchase-1",
      supabaseId: "supabase-1",
      idempotencyKey: "idem-1",
      method: "PIX",
      customer: { name: "Cliente", email: "cliente@example.com", taxId: "123", cellphone: "999" },
    })

    expect(result).toMatchObject({
      status: "PENDING",
      requiresReconciliation: true,
      reason: "REMOTE_TIMEOUT",
    })
    expect(dependencies.identities.bind).not.toHaveBeenCalled()
    expect(JSON.stringify(result)).not.toContain("token")
  })

  it("devolve as instruções PIX persistidas em replay idempotente", async () => {
    const persistedPix = {
      brCode: "000201",
      brCodeBase64: "base64",
      expiresAt: "2026-10-18T13:00:00.000Z",
    }
    const dependencies = makeDependencies(
      { status: "UNKNOWN", externalId: null, reason: "REMOTE_ERROR" },
      { status: "PENDING", externalId: "pay_1", paymentInstructions: persistedPix },
    )
    const service = new PaymentProviderPaymentService(dependencies)

    const result = await service.startPayment({
      purchaseId: "purchase-1",
      supabaseId: "supabase-1",
      idempotencyKey: "idem-1",
      method: "PIX",
      customer: { name: "Cliente", email: "cliente@example.com", taxId: "123", cellphone: "999" },
    })

    expect(result).toMatchObject({
      status: "PENDING",
      externalId: "pay_1",
      pix: persistedPix,
    })
    expect(dependencies.sessions.acquireAttemptLease).not.toHaveBeenCalled()
  })

  it("libera a lease quando a criação no provider falha definitivamente", async () => {
    const dependencies = makeDependencies(
      { status: "PENDING", externalId: "pay_1" },
      {},
      new Error("Token do cartão expirado"),
    )
    const service = new PaymentProviderPaymentService(dependencies)

    await expect(
      service.startPayment({
        purchaseId: "purchase-1",
        supabaseId: "supabase-1",
        idempotencyKey: "idem-1",
        method: "PIX",
        customer: { name: "Cliente", email: "cliente@example.com", taxId: "123", cellphone: "999" },
      }),
    ).rejects.toThrow("Token do cartão expirado")

    expect(dependencies.sessions.releaseAttemptLease).toHaveBeenCalledTimes(1)
    expect(dependencies.sessions.releaseAttemptLease).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      lease: {
        leaseToken: "lease-1",
        leaseUntil: new Date("2026-10-18T12:01:00.000Z"),
        fenceVersion: 1,
      },
      now: expect.any(Date),
    })
    expect(dependencies.sessions.updateAttemptWithLease).not.toHaveBeenCalled()
  })

  it("não mascara o erro do provider quando a liberação da lease também falha", async () => {
    const dependencies = makeDependencies(
      { status: "PENDING", externalId: "pay_1" },
      {},
      new Error("Token do cartão expirado"),
    )
    dependencies.sessions.releaseAttemptLease = mock(async () => {
      throw new Error("banco indisponível")
    })
    const errorSpy = spyOn(console, "error").mockImplementation(() => {})
    const service = new PaymentProviderPaymentService(dependencies)

    try {
      await expect(
        service.startPayment({
          purchaseId: "purchase-1",
          supabaseId: "supabase-1",
          idempotencyKey: "idem-1",
          method: "PIX",
          customer: { name: "Cliente", email: "cliente@example.com", taxId: "123", cellphone: "999" },
        }),
      ).rejects.toThrow("Token do cartão expirado")

      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })
})
