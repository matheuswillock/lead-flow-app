import { beforeEach, describe, expect, it, mock } from "bun:test"
import { createHash } from "node:crypto"

const attemptUpdateManyMock = mock(async (_args?: unknown) => ({ count: 1 }))
const attemptFindFirstMock = mock(async (_args?: unknown): Promise<unknown> => null)
const attemptFindFirstOrThrowMock = mock(async (_args?: unknown): Promise<unknown> => null)
const attemptFindManyMock = mock(async (_args?: unknown): Promise<unknown[]> => [])
const attemptUpsertMock = mock(async (_args?: unknown): Promise<unknown> => null)
const attemptFindUniqueOrThrowMock = mock(async (_args?: unknown): Promise<unknown> => null)
const sessionFindUniqueMock = mock(async (_args?: unknown): Promise<unknown> => null)
const queryRawMock = mock(async (..._args: unknown[]): Promise<Array<{ id: string }>> => [])

const transactionMock = mock(async (callback: (tx: unknown) => Promise<unknown>) =>
  callback({
    paymentProviderSession: { findUnique: sessionFindUniqueMock },
    paymentProviderAttempt: {
      findFirst: attemptFindFirstMock,
      upsert: attemptUpsertMock,
      updateMany: attemptUpdateManyMock,
    },
  }),
)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    paymentProviderAttempt: {
      updateMany: attemptUpdateManyMock,
      findFirst: attemptFindFirstMock,
      findFirstOrThrow: attemptFindFirstOrThrowMock,
      findMany: attemptFindManyMock,
      upsert: attemptUpsertMock,
      findUniqueOrThrow: attemptFindUniqueOrThrowMock,
    },
    $queryRaw: queryRawMock,
    $transaction: transactionMock,
  },
}))

const { PaymentProviderSessionRepository } = await import("./PaymentProviderSessionRepository")

const REQUEST_FINGERPRINT_HASH = createHash("sha256").update("fingerprint-1", "utf8").digest("hex")

function makeAttemptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    attemptNumber: 1,
    idempotencyKey: "idem-1",
    requestFingerprint: REQUEST_FINGERPRINT_HASH,
    providerKey: "ABACATE_PAY",
    environment: "DEV",
    externalAccountContext: "abacate-dev",
    status: "CREATED",
    externalId: null,
    leaseToken: null,
    leaseUntil: null,
    fenceVersion: 0,
    unknownReason: null,
    lastEventClaimToken: null,
    paymentInstructions: null,
    session: { tenantId: "team-1", ownerType: "PLATFORM_PURCHASE", ownerId: "purchase-1" },
    ...overrides,
  }
}

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    providerKey: "ABACATE_PAY",
    environment: "DEV",
    externalAccountContext: "abacate-dev",
    status: "OPEN",
    expiresAt: new Date("2026-10-18T13:00:00.000Z"),
    tenantId: "team-1",
    ownerType: "PLATFORM_PURCHASE",
    ownerId: "purchase-1",
    ...overrides,
  }
}

const now = new Date("2026-10-18T12:00:00.000Z")

const createAttemptInput = {
  sessionId: "session-1",
  tenantId: "team-1",
  ownerType: "PLATFORM_PURCHASE",
  ownerId: "purchase-1",
  now,
  attemptNumber: 1,
  idempotencyKey: "idem-1",
  requestFingerprint: "fingerprint-1",
  provider: "ABACATE_PAY" as const,
  environment: "DEV" as const,
  externalAccountContext: "abacate-dev",
}

const lease = {
  leaseToken: "22222222-2222-2222-2222-222222222222",
  leaseUntil: new Date("2026-10-18T12:01:00.000Z"),
  fenceVersion: 1,
}

function firstCall(mocked: ReturnType<typeof mock>): Record<string, unknown> {
  return (mocked.mock.calls[0] as unknown[])[0] as Record<string, unknown>
}

function whereOf(args: unknown): Record<string, unknown> {
  return (args as { where?: Record<string, unknown> } | undefined)?.where ?? {}
}

beforeEach(() => {
  attemptUpdateManyMock.mockClear()
  attemptFindFirstMock.mockClear()
  attemptFindFirstOrThrowMock.mockClear()
  attemptFindManyMock.mockClear()
  attemptUpsertMock.mockClear()
  attemptFindUniqueOrThrowMock.mockClear()
  sessionFindUniqueMock.mockClear()
  queryRawMock.mockClear()
  attemptUpdateManyMock.mockImplementation(async () => ({ count: 1 }))
  attemptFindFirstMock.mockImplementation(async () => null)
  attemptFindFirstOrThrowMock.mockImplementation(async () => makeAttemptRow({ status: "PENDING" }))
  attemptFindManyMock.mockImplementation(async () => [])
  attemptUpsertMock.mockImplementation(async () => makeAttemptRow())
  attemptFindUniqueOrThrowMock.mockImplementation(async () => makeAttemptRow())
  sessionFindUniqueMock.mockImplementation(async () => makeSessionRow())
  queryRawMock.mockImplementation(async () => [])
})

describe("PaymentProviderSessionRepository", () => {
  it("aplica o primeiro evento mesmo com claim token nulo na tentativa", async () => {
    const repository = new PaymentProviderSessionRepository()

    const attempt = await repository.applyEventWithClaim({
      externalId: "abacate-payment-1",
      provider: "ABACATE_PAY",
      environment: "DEV",
      externalAccountContext: "abacate-dev",
      expectedStatus: "CREATED",
      nextStatus: "PENDING",
      claimToken: "claim-1",
      now,
    })

    expect(attempt.status).toBe("PENDING")
    expect(attemptUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ lastEventClaimToken: null }, { NOT: { lastEventClaimToken: "claim-1" } }],
        }),
      }),
    )
  })

  it("bloqueia nova tentativa quando o mesmo checkout possui UNKNOWN pendente", async () => {
    attemptFindFirstMock.mockImplementation(async (args?: unknown) => {
      const where = whereOf(args)
      if ("sessionId" in where) return { attemptNumber: 1 }
      if (where.status === "UNKNOWN") return { id: "attempt-unknown" }
      return null
    })
    const repository = new PaymentProviderSessionRepository()

    await expect(repository.createAttempt({ ...createAttemptInput })).rejects.toThrow(
      "O checkout possui tentativa UNKNOWN pendente de reconciliação",
    )
    expect(attemptFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "UNKNOWN",
          session: {
            is: {
              tenantId: "team-1",
              ownerType: "PLATFORM_PURCHASE",
              ownerId: "purchase-1",
            },
          },
        }),
      }),
    )
  })

  it("permite retry idempotente quando o UNKNOWN pertence à própria tentativa", async () => {
    attemptFindFirstMock.mockImplementation(async (args?: unknown) => {
      const where = whereOf(args)
      if ("sessionId" in where) return { attemptNumber: 1 }
      if (where.status === "UNKNOWN") return { id: "attempt-1" }
      return null
    })
    const repository = new PaymentProviderSessionRepository()

    const attempt = await repository.createAttempt({ ...createAttemptInput })

    expect(attempt.id).toBe("attempt-1")
  })

  it("aceita POST_PAYMENT em sessão expirada ao adquirir lease", async () => {
    attemptFindFirstMock.mockImplementation(async (args?: unknown) => {
      const where = whereOf(args)
      if ("leaseToken" in where) return makeAttemptRow({ status: "CONFIRMED" })
      return null
    })
    const repository = new PaymentProviderSessionRepository()

    await repository.acquireAttemptLease({
      attemptId: "attempt-1",
      tenantId: "team-1",
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      purpose: "POST_PAYMENT",
      now,
      ttlMs: 60_000,
    })

    const call = firstCall(attemptUpdateManyMock) as {
      where: { session: { is: Record<string, unknown> } }
    }
    expect(call.where.session.is).toEqual({
      tenantId: "team-1",
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      status: { in: ["OPEN", "EXPIRED"] },
    })
  })

  it("exige sessão viva para iniciar pagamento ao adquirir lease", async () => {
    attemptFindFirstMock.mockImplementation(async (args?: unknown) => {
      const where = whereOf(args)
      if ("leaseToken" in where) return makeAttemptRow({ status: "CREATED" })
      return null
    })
    const repository = new PaymentProviderSessionRepository()

    await repository.acquireAttemptLease({
      attemptId: "attempt-1",
      tenantId: "team-1",
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      purpose: "PAYMENT",
      now,
      ttlMs: 60_000,
    })

    const call = firstCall(attemptUpdateManyMock) as {
      where: { session: { is: Record<string, unknown> } }
    }
    expect(call.where.session.is).toEqual({
      tenantId: "team-1",
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      status: "OPEN",
      expiresAt: { gt: now },
    })
  })

  it("finaliza POST_PAYMENT após a expiração e persiste as instruções PIX", async () => {
    const pix = {
      brCode: "000201",
      brCodeBase64: "base64",
      expiresAt: "2026-10-18T13:00:00.000Z",
    }
    attemptFindUniqueOrThrowMock.mockImplementation(async () =>
      makeAttemptRow({ status: "REFUNDED", externalId: "abacate-payment-1" }),
    )
    const repository = new PaymentProviderSessionRepository()

    await repository.updateAttemptWithLease({
      attemptId: "attempt-1",
      tenantId: "team-1",
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      lease,
      now,
      status: "REFUNDED",
      expectedStatus: "CONFIRMED",
      operation: "POST_PAYMENT",
      externalId: "abacate-payment-1",
      paymentInstructions: pix,
    })

    const call = firstCall(attemptUpdateManyMock) as {
      where: { session: { is: Record<string, unknown> } }
      data: Record<string, unknown>
    }
    expect(call.where.session.is).toEqual({
      tenantId: "team-1",
      ownerType: "PLATFORM_PURCHASE",
      ownerId: "purchase-1",
      status: { in: ["OPEN", "EXPIRED"] },
    })
    expect(call.data).toEqual(expect.objectContaining({ paymentInstructions: pix }))
  })

  it("lista tentativas elegíveis por join e preserva a ordem retornada", async () => {
    queryRawMock.mockImplementation(async () => [{ id: "attempt-b" }, { id: "attempt-a" }])
    attemptFindManyMock.mockImplementation(async () => [
      makeAttemptRow({ id: "attempt-a", status: "CONFIRMED", externalId: "pay-a" }),
      makeAttemptRow({ id: "attempt-b", status: "CONFIRMED", externalId: "pay-b" }),
    ])
    const repository = new PaymentProviderSessionRepository()

    const rows = await repository.listAttemptsPendingEmailCreditEntitlements({ limit: 25 })

    expect(rows.map((row) => row.id)).toEqual(["attempt-b", "attempt-a"])
    expect(attemptFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["attempt-b", "attempt-a"] } } }),
    )
    const rawCallArgs = queryRawMock.mock.calls[0] as unknown[]
    expect(rawCallArgs[1]).toBe(25)
  })

  it("rejeita limite inválido antes de consultar o banco", async () => {
    const repository = new PaymentProviderSessionRepository()

    await expect(repository.listAttemptsPendingReconciliation({ limit: 0 })).rejects.toThrow(
      "Limite de tentativas inválido",
    )
    expect(queryRawMock).not.toHaveBeenCalled()
  })
})
