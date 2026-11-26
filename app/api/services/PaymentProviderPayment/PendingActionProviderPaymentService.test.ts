import { describe, expect, it, mock } from "bun:test"
import { PendingActionProviderPaymentService } from "./PendingActionProviderPaymentService"

const paidAt = new Date("2026-11-25T12:00:00Z")
const attempt = {
  id: "attempt-1",
  externalId: "ext_1",
  ownerType: "PENDING_ACTION_ADDON",
  ownerId: "pa-1",
  provider: "SOME_PROVIDER",
  environment: "DEV",
  externalAccountContext: "ctx",
  requestFingerprint: JSON.stringify({ method: "CARD" }),
}

function build(overrides: {
  attempt?: unknown
  status?: Record<string, unknown> | Error
  settle?: () => Promise<unknown>
} = {}) {
  const getStatus = mock(async (_input: unknown): Promise<any> => {
    if (overrides.status instanceof Error) throw overrides.status
    return { status: "CONFIRMED", amountInCents: 5000, ...overrides.status }
  })
  const settleConfirmed = mock(overrides.settle ?? (async () => "settled"))
  const findAttemptById = mock(async (_id: string) => ("attempt" in overrides ? overrides.attempt : attempt))
  const service = new PendingActionProviderPaymentService({
    sessions: { findAttemptById } as any,
    resolveQueryProvider: async () => ({ getStatus }) as any,
    settlement: { settleConfirmed } as any,
    now: () => paidAt,
  })
  return { service, getStatus, settleConfirmed }
}

const target = { id: "pa-1", providerAttemptId: "attempt-1" }

describe("PendingActionProviderPaymentService", () => {
  it("confirmado: liquida o add-on com o valor informado pelo provedor", async () => {
    const { service, getStatus, settleConfirmed } = build()

    expect(await service.settle(target)).toEqual({ outcome: "settled" })
    expect(getStatus).toHaveBeenCalledWith({ externalId: "ext_1", method: "CARD" })
    expect(settleConfirmed).toHaveBeenCalledWith({
      ownerType: "PENDING_ACTION_ADDON",
      ownerId: "pa-1",
      externalId: "ext_1",
      amountInCents: 5000,
      paidAt,
    })
  })

  it("pendente: não liquida", async () => {
    const { service, settleConfirmed } = build({ status: { status: "PENDING" } })

    expect(await service.settle(target)).toEqual({ outcome: "not_confirmed", status: "PENDING" })
    expect(settleConfirmed).not.toHaveBeenCalled()
  })

  it("status UNKNOWN: indeterminado, não liquida", async () => {
    const { service, settleConfirmed } = build({ status: { status: "UNKNOWN" } })

    expect((await service.settle(target)).outcome).toBe("indeterminate")
    expect(settleConfirmed).not.toHaveBeenCalled()
  })

  it("erro ao consultar o provedor: indeterminado, não liquida", async () => {
    const { service, settleConfirmed } = build({ status: new Error("timeout") })

    expect((await service.settle(target)).outcome).toBe("indeterminate")
    expect(settleConfirmed).not.toHaveBeenCalled()
  })

  it("ação sem tentativa registrada: indeterminado, sem consultar o provedor", async () => {
    const { service, getStatus } = build()

    expect((await service.settle({ id: "pa-1", providerAttemptId: null })).outcome).toBe("indeterminate")
    expect(getStatus).not.toHaveBeenCalled()
  })

  it("tentativa de outro owner: indeterminado, sem consultar o provedor", async () => {
    const { service, getStatus } = build({ attempt: { ...attempt, ownerId: "outra-acao" } })

    expect((await service.settle(target)).outcome).toBe("indeterminate")
    expect(getStatus).not.toHaveBeenCalled()
  })

  it("liquidação recusada (valor divergente): settlement_failed com a mensagem", async () => {
    const { service } = build({
      settle: async () => {
        throw new Error("Valor pago não confere com a cobrança do add-on")
      },
    })

    expect(await service.settle(target)).toEqual({
      outcome: "settlement_failed",
      message: "Valor pago não confere com a cobrança do add-on",
    })
  })
})
