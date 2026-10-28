import { describe, expect, it } from "bun:test"
import type { StoredPaymentProviderAttemptRecord } from "@/app/api/infra/data/repositories/paymentProviderSession/IPaymentProviderSessionRepository"
import { PaymentProviderError } from "@/lib/payment-provider/errors"
import type {
  PaymentAttemptStatus,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "@/lib/payment-provider/types"
import {
  createApplyPaymentEvent,
  type ApplyPaymentEventDependencies,
} from "./applyPaymentEvent"

const CONTEXT = {
  environment: "PRODUCTION",
  externalAccountContext: "abacate-prod",
  routeVersion: "TEST-ROUTE",
} as const

function makeAttempt(
  overrides: Partial<StoredPaymentProviderAttemptRecord> = {},
): StoredPaymentProviderAttemptRecord {
  return {
    id: "attempt-1",
    sessionId: "session-1",
    attemptNumber: 1,
    idempotencyKey: "idem-1",
    requestFingerprint: "fp-1",
    provider: "ABACATE_PAY",
    environment: "PRODUCTION",
    externalAccountContext: "abacate-prod",
    tenantId: "tenant-1",
    ownerType: "PLATFORM_PURCHASE",
    ownerId: "purchase-1",
    status: "PENDING",
    externalId: "charge-1",
    reconciliationReference: null,
    unknownReason: null,
    paymentInstructions: null,
    lease: { leaseToken: null, leaseUntil: null, fenceVersion: 0 },
    ...overrides,
  }
}

function makeEvent(overrides: Partial<ProviderWebhookEvent> = {}): ProviderWebhookEvent {
  return {
    eventId: "evt-1",
    event: "PAYMENT_CONFIRMED",
    environment: "PRODUCTION",
    method: "PIX",
    amountInCents: 9900,
    occurredAt: null,
    disputeEpoch: null,
    externalPaymentId: "charge-1",
    status: "CONFIRMED",
    ...overrides,
  } as ProviderWebhookEvent
}

function statusResult(overrides: Partial<ProviderStatusResult> = {}): ProviderStatusResult {
  return {
    externalId: "charge-1",
    method: "PIX",
    status: "CONFIRMED",
    amountInCents: 9900,
    currency: "BRL",
    ...overrides,
  } as ProviderStatusResult
}

type Harness = ReturnType<typeof createHarness>

function createHarness(options: {
  readonly attempt?: StoredPaymentProviderAttemptRecord | null
  readonly status?: ProviderStatusResult | Error
  readonly settled?: "settled" | "unsupported"
} = {}) {
  const calls: string[] = []
  const settleInputs: unknown[] = []
  const alerts = {
    disputes: [] as unknown[],
    rejections: [] as unknown[],
    unknownOwners: [] as unknown[],
  }
  const attempt = options.attempt === undefined ? makeAttempt() : options.attempt
  const dependencies: ApplyPaymentEventDependencies = {
    provider: {
      getStatus: async (input) => {
        calls.push(`getStatus:${input.externalId}:${input.method}`)
        const result = options.status ?? statusResult()
        if (result instanceof Error) throw result
        return result
      },
    },
    sessions: {
      findAttemptByExternalId: async () => attempt,
      findAttemptById: async () => attempt,
      applyEventWithClaim: async (input) => {
        calls.push(`applyEventWithClaim:${input.nextStatus}`)
        return makeAttempt({ status: input.nextStatus })
      },
    },
    identities: {
      bind: async () => {
        calls.push("bind")
        return {} as never
      },
    },
    purchases: {
      markPaidOnceForProvider: async () => {
        calls.push("markPaid")
        return null
      },
    },
    settlement: {
      settleConfirmed: async (input) => {
        calls.push("settle")
        settleInputs.push(input)
        return options.settled ?? "settled"
      },
    },
    alerts: {
      unknownOwnerType: (value) => alerts.unknownOwners.push(value),
      paymentDisputed: (value) => alerts.disputes.push(value),
      confirmationRejected: (value) => alerts.rejections.push(value),
    },
    context: CONTEXT,
    now: () => new Date("2026-10-27T12:00:00.000Z"),
  }
  return { apply: createApplyPaymentEvent(dependencies), calls, settleInputs, alerts }
}

function run(
  harness: Harness,
  event: ProviderWebhookEvent,
  nextStatus: PaymentAttemptStatus = "CONFIRMED",
) {
  return harness.apply({ event, nextStatus, claimToken: "claim-1" })
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("Era esperado um erro")
}

describe("createApplyPaymentEvent - confirmação reconsultada no provider", () => {
  it("confirma PLATFORM_PURCHASE quando o provider devolve PAID com o mesmo valor", async () => {
    const harness = createHarness()

    await run(harness, makeEvent())

    expect(harness.calls).toEqual([
      "getStatus:charge-1:PIX",
      "applyEventWithClaim:CONFIRMED",
      "bind",
      "markPaid",
    ])
  })

  it("liquida o owner de adesão com o valor consultado, não o do evento", async () => {
    const harness = createHarness({
      attempt: makeAttempt({ ownerType: "BACKOFFICE_ADHESION" }),
    })

    await run(harness, makeEvent())

    expect(harness.settleInputs).toEqual([
      {
        ownerType: "BACKOFFICE_ADHESION",
        ownerId: "purchase-1",
        externalId: "charge-1",
        amountInCents: 9900,
        paidAt: new Date("2026-10-27T12:00:00.000Z"),
      },
    ])
  })

  it("alerta quando o owner confirmado não tem efeito de domínio", async () => {
    const harness = createHarness({
      attempt: makeAttempt({ ownerType: "OWNER_DESCONHECIDO" }),
      settled: "unsupported",
    })

    await run(harness, makeEvent())

    expect(harness.alerts.unknownOwners).toHaveLength(1)
  })

  it("rejeita sem nenhuma mutação quando o valor consultado difere do evento", async () => {
    const harness = createHarness({ status: statusResult({ amountInCents: 100 }) })

    const error = await captureError(run(harness, makeEvent({ amountInCents: 9900 })))

    expect(error).toBeInstanceOf(PaymentProviderError)
    expect((error as PaymentProviderError).code).toBe("WEBHOOK_INVALID")
    expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
    expect(harness.alerts.rejections).toHaveLength(1)
  })

  it.each(["EXPIRED", "CANCELED", "REFUNDED", "FAILED", "DISPUTED"] as const)(
    "rejeita sem retry quando o pagamento consultado é terminal %s",
    async (status) => {
      const harness = createHarness({ status: statusResult({ status }) })

      const error = await captureError(run(harness, makeEvent()))

      expect((error as PaymentProviderError).code).toBe("WEBHOOK_INVALID")
      expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
      expect(harness.alerts.rejections).toHaveLength(1)
    },
  )

  it("não deixa o alerta de rejeição carregar segredo, payload ou URL", async () => {
    const harness = createHarness({ status: statusResult({ status: "EXPIRED" }) })

    await captureError(run(harness, makeEvent()))

    expect(harness.alerts.rejections).toEqual([
      {
        eventId: "evt-1",
        externalPaymentId: "charge-1",
        attemptId: "attempt-1",
        ownerType: "PLATFORM_PURCHASE",
        queriedStatus: "EXPIRED",
        queriedAmountInCents: 9900,
        eventAmountInCents: 9900,
        reason: "STATUS_NOT_PAID",
      },
    ])
  })

  it.each(["PENDING", "CREATED"] as const)(
    "gera erro retentável (5xx) enquanto o provider ainda mostra %s",
    async (status) => {
      const harness = createHarness({ status: statusResult({ status }) })

      const error = await captureError(run(harness, makeEvent()))

      expect(error).toBeInstanceOf(PaymentProviderError)
      expect((error as PaymentProviderError).code).not.toBe("WEBHOOK_INVALID")
      expect((error as PaymentProviderError).retryable).toBe(true)
      expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
      expect(harness.alerts.rejections).toHaveLength(0)
    },
  )

  it("gera erro retentável quando a consulta é indeterminada (UNKNOWN)", async () => {
    const harness = createHarness({
      status: statusResult({
        status: "UNKNOWN",
        amountInCents: null,
        reason: "REMOTE_TIMEOUT",
        requiresReconciliation: true,
      } as Partial<ProviderStatusResult>),
    })

    const error = await captureError(run(harness, makeEvent()))

    expect((error as PaymentProviderError).retryable).toBe(true)
    expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
  })

  // GET /v2/transparents/check devolve só id, status e expiresAt (capturado na API sandbox em
  // 2026-10-28): o valor não vem na consulta, então PAID é a prova e o valor do evento é o usado.
  it("formato real do check (sem valor): confirma com PAID e liquida o owner com o valor do evento", async () => {
    const harness = createHarness({
      attempt: makeAttempt({ ownerType: "BACKOFFICE_ADHESION" }),
      status: statusResult({ amountInCents: null }),
    })

    await run(harness, makeEvent({ amountInCents: 9900 }))

    expect(harness.calls).toContain("applyEventWithClaim:CONFIRMED")
    expect(harness.settleInputs).toEqual([
      {
        ownerType: "BACKOFFICE_ADHESION",
        ownerId: "purchase-1",
        externalId: "charge-1",
        amountInCents: 9900,
        paidAt: new Date("2026-10-27T12:00:00.000Z"),
      },
    ])
  })

  it("confirma mesmo quando nem o check nem o evento trazem valor: quem liquida decide com o valor esperado", async () => {
    const harness = createHarness({
      attempt: makeAttempt({ ownerType: "BACKOFFICE_ADHESION" }),
      status: statusResult({ amountInCents: null }),
    })

    await run(harness, makeEvent({ amountInCents: null }))

    expect(harness.calls).toContain("applyEventWithClaim:CONFIRMED")
    expect(harness.settleInputs[0]).toMatchObject({ amountInCents: null })
  })

  it("sem valor no check, status que não é PAID continua rejeitado sem nenhuma mutação", async () => {
    const harness = createHarness({ status: statusResult({ status: "EXPIRED", amountInCents: null }) })

    const error = await captureError(run(harness, makeEvent()))

    expect((error as PaymentProviderError).code).toBe("WEBHOOK_INVALID")
    expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
  })

  it("propaga a falha de rede da consulta como retentável, sem mutação", async () => {
    const failure = new PaymentProviderError("REMOTE_TIMEOUT", "timeout", true)
    const harness = createHarness({ status: failure })

    const error = await captureError(run(harness, makeEvent()))

    expect(error).toBe(failure)
    expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
  })

  it("trata id externo inválido na consulta como evento inválido (4xx)", async () => {
    const harness = createHarness({
      status: new PaymentProviderError("VALIDATION_FAILED", "ID externo inválido"),
    })

    const error = await captureError(run(harness, makeEvent()))

    expect((error as PaymentProviderError).code).toBe("WEBHOOK_INVALID")
    expect(harness.calls).toEqual(["getStatus:charge-1:PIX"])
  })

  it("usa o método do evento na consulta quando for cartão", async () => {
    const harness = createHarness({ status: statusResult({ method: "CARD" }) })

    await run(harness, makeEvent({ method: "CARD" }))

    expect(harness.calls[0]).toBe("getStatus:charge-1:CARD")
  })

  it("não consulta o provider quando a tentativa não existe e mantém o erro", async () => {
    const harness = createHarness({ attempt: null })

    await expect(run(harness, makeEvent())).rejects.toThrow("Tentativa não encontrada para o evento")
    expect(harness.calls).toEqual([])
  })
})

describe("createApplyPaymentEvent - outros eventos", () => {
  it("não reconsulta o provider para reembolso", async () => {
    const harness = createHarness({ attempt: makeAttempt({ status: "CONFIRMED" }) })

    await run(harness, makeEvent({ event: "PAYMENT_REFUNDED", status: "REFUNDED" }), "REFUNDED")

    expect(harness.calls).toEqual(["applyEventWithClaim:REFUNDED", "bind"])
  })

  it("alerta a disputa com o id da cobrança, sem reembolso automático", async () => {
    const harness = createHarness({ attempt: makeAttempt({ status: "CONFIRMED" }) })

    await run(harness, makeEvent({ event: "PAYMENT_DISPUTED", status: "DISPUTED" }), "DISPUTED")

    expect(harness.calls).toEqual(["applyEventWithClaim:DISPUTED", "bind"])
    expect(harness.alerts.disputes).toEqual([
      {
        eventId: "evt-1",
        externalPaymentId: "charge-1",
        attemptId: "attempt-1",
        ownerType: "PLATFORM_PURCHASE",
        ownerId: "purchase-1",
        tenantId: "tenant-1",
      },
    ])
  })

  it("não alerta disputa quando a transição falha", async () => {
    const harness = createHarness({ attempt: makeAttempt({ status: "CONFIRMED" }) })
    const failing = createApplyPaymentEvent({
      provider: { getStatus: async () => statusResult() },
      sessions: {
        findAttemptByExternalId: async () => makeAttempt({ status: "CONFIRMED" }),
        findAttemptById: async () => null,
        applyEventWithClaim: async () => {
          throw new Error("CAS perdido")
        },
      },
      identities: { bind: async () => ({}) as never },
      purchases: { markPaidOnceForProvider: async () => null },
      settlement: { settleConfirmed: async () => "settled" },
      alerts: {
        unknownOwnerType: () => undefined,
        paymentDisputed: (value) => harness.alerts.disputes.push(value),
        confirmationRejected: () => undefined,
      },
      context: CONTEXT,
    })

    await expect(
      failing({
        event: makeEvent({ event: "PAYMENT_DISPUTED", status: "DISPUTED" }),
        nextStatus: "DISPUTED",
        claimToken: "claim-1",
      }),
    ).rejects.toThrow("CAS perdido")
    expect(harness.alerts.disputes).toHaveLength(0)
  })
})
