import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { NextRequest } from "next/server"
import { PaymentProviderMaintenanceUseCase } from "@/app/api/useCases/paymentProviderPayment/PaymentProviderMaintenanceUseCase"
// --isolate: os mocks de módulo abaixo valem apenas para este arquivo.

type PaymentProviderMaintenanceResult = Awaited<
  ReturnType<ConstructorParameters<typeof PaymentProviderMaintenanceUseCase>[0]["run"]>
>

const CLEAN_RESULT: PaymentProviderMaintenanceResult = {
  reconciled: 0,
  stillUnknown: 0,
  skipped: 0,
  entitlementsApplied: 0,
  entitlementsAlreadyApplied: 0,
  entitlementFailures: 0,
  purchasesActivated: 0,
  purchaseActivationFailures: 0,
  ownerAttemptsReconciled: 0,
  ownerSettlementsRepaired: 0,
  ownerSettlementFailures: 0,
}

let serviceResult: PaymentProviderMaintenanceResult = CLEAN_RESULT
const run = mock(async (_input: { limit?: number }) => serviceResult)

mock.module("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
  connection: async () => {},
}))

mock.module("@/app/api/useCases/paymentProviderPayment/paymentProviderPaymentComposition", () => ({
  getPaymentProviderMaintenanceUseCase: () => new PaymentProviderMaintenanceUseCase({ run }),
}))

// Reproduz o contrato do withCronAudit: Output inválido aciona o callback de falha (Slack).
const onFailureCalls: string[] = []
mock.module("@/app/api/lib/cron/withCronAudit", () => ({
  withCronAudit: async (
    _config: unknown,
    handler: () => Promise<{ isValid: boolean; errorMessages: string[] }>,
    dependencies?: { onFailure?: (params: { error: string }) => Promise<void> },
  ) => {
    const output = await handler()
    if (!output.isValid) await dependencies?.onFailure?.({ error: output.errorMessages.join("; ") })
    return output
  },
}))
mock.module("@/app/api/lib/cron/cronSlackCallback", () => ({
  getDefaultCronSlackCallback: () => async (params: { error: string }) => {
    onFailureCalls.push(params.error)
  },
}))

const { GET } = await import("./route")

function makeRequest(headers: Record<string, string> = {}) {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest
}

const authorized = () => makeRequest({ authorization: "Bearer test-secret" })

describe("GET /api/v1/payment-provider/cron/maintenance", () => {
  beforeEach(() => {
    run.mockClear()
    onFailureCalls.length = 0
    serviceResult = CLEAN_RESULT
    process.env.CRON_SECRET = "test-secret"
  })

  it("sem Authorization correto responde 401 e não executa a manutenção", async () => {
    const response = (await GET(makeRequest({ authorization: "Bearer errado" }))) as { status: number }

    expect(response.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })

  it("com todos os contadores de falha zerados responde 200 e não dispara o alerta", async () => {
    const response = (await GET(authorized())) as { status: number }

    expect(response.status).toBe(200)
    expect(onFailureCalls).toEqual([])
  })

  it("falha parcial responde 500 e dispara o alerta listando o contador", async () => {
    serviceResult = { ...CLEAN_RESULT, ownerSettlementFailures: 2 }

    const response = (await GET(authorized())) as { status: number }

    expect(response.status).toBe(500)
    expect(onFailureCalls).toHaveLength(1)
    expect(onFailureCalls[0]).toContain("ownerSettlementFailures=2")
  })
})
