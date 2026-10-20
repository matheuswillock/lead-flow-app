import { beforeEach, describe, expect, it, mock } from "bun:test"

const executeMock = mock(async () => ({
  isValid: true,
  successMessages: ["Auditoria DNS concluída"],
  errorMessages: [],
  result: { total: 2, verified: 1, pending: 1, failed: 0, inconclusive: 0, notified: 0, errors: 0 },
}))

mock.module("next/server", () => ({
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }) },
  connection: async () => {},
}))

mock.module("@/app/api/useCases/studioDomainDnsAudit/StudioDomainDnsAuditUseCase", () => ({
  studioDomainDnsAuditUseCase: { execute: executeMock },
}))

mock.module("@/app/api/lib/cron/withCronAudit", () => ({
  withCronAudit: async (_config: unknown, handler: () => Promise<unknown>) => handler(),
}))

mock.module("@/app/api/lib/cron/cronSlackCallback", () => ({
  getDefaultCronSlackCallback: () => undefined,
}))

const { GET } = await import("./route")

function makeRequest(headers: Record<string, string> = {}) {
  return { headers: { get: (key: string) => headers[key.toLowerCase()] ?? null } } as unknown as import("next/server").NextRequest
}

describe("GET /api/v1/studio/cron/reconcile-dns", () => {
  beforeEach(() => {
    executeMock.mockClear()
    process.env.CRON_SECRET = "test-secret"
  })

  it("retorna 401 sem segredo", async () => {
    delete process.env.CRON_SECRET
    const response = (await GET(makeRequest())) as { status: number }

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("retorna 401 com bearer incorreto", async () => {
    const response = (await GET(makeRequest({ authorization: "Bearer errado" }))) as { status: number }

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("executa com bearer válido e retorna o resumo seguro", async () => {
    const response = (await GET(makeRequest({ authorization: "Bearer test-secret" }))) as unknown as {
      status: number
      body: { result: { total: number; pending: number } }
    }

    expect(response.status).toBe(200)
    expect(response.body.result).toMatchObject({ total: 2, pending: 1 })
    expect(executeMock).toHaveBeenCalledTimes(1)
  })
})
