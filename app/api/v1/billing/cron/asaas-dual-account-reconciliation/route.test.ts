import { beforeEach, describe, expect, it, mock } from "bun:test"

const executeMock = mock(async () => ({
  isValid: true,
  successMessages: ["ok"],
  errorMessages: [],
  result: { staleLedgerRows: [] },
}))

mock.module("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
  },
  connection: async () => {},
}))

mock.module(
  "@/app/api/useCases/asaasAccountMigration/AsaasDualAccountReconciliationUseCase",
  () => ({
    asaasDualAccountReconciliationUseCase: { execute: executeMock },
  })
)

mock.module("@/app/api/lib/cron/withCronAudit", () => ({
  withCronAudit: async (_config: unknown, handler: () => Promise<unknown>) => handler(),
}))

mock.module("@/app/api/lib/cron/cronSlackCallback", () => ({
  getDefaultCronSlackCallback: () => undefined,
}))

const { GET } = await import("./route")

function makeRequest(headers: Record<string, string> = {}) {
  return {
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
  } as unknown as import("next/server").NextRequest
}

describe("GET /api/v1/billing/cron/asaas-dual-account-reconciliation (T-30.25)", () => {
  beforeEach(() => {
    executeMock.mockClear()
    process.env.CRON_SECRET = "test-secret"
  })

  it("sem CRON_SECRET configurado → 401, não executa o use case", async () => {
    delete process.env.CRON_SECRET
    const response = (await GET(makeRequest())) as { status: number }

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("com Authorization incorreto → 401, não executa o use case", async () => {
    const response = (await GET(makeRequest({ authorization: "Bearer errado" }))) as {
      status: number
    }

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("com Authorization correto → 200 e executa o use case de reconciliação", async () => {
    const response = (await GET(makeRequest({ authorization: "Bearer test-secret" }))) as {
      status: number
    }

    expect(response.status).toBe(200)
    expect(executeMock).toHaveBeenCalledTimes(1)
  })
})
