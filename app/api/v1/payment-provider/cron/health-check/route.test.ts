import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({ NextRequest, NextResponse, after, connection: mock(async () => undefined) }))
mock.module("server-only", () => ({}))
const execute = mock(async () => new Output(true, ["ok"], [], { checked: 1 }))
mock.module("@/app/api/useCases/paymentProviderConfig/paymentProviderConfigComposition", () => ({
  paymentProviderHealthSweepUseCase: { execute },
}))
const withCronAudit = mock(async (_config: unknown, handler: () => Promise<Output>) => handler())
mock.module("@/app/api/lib/cron/withCronAudit", () => ({ withCronAudit }))
mock.module("@/app/api/lib/cron/cronSlackCallback", () => ({ getDefaultCronSlackCallback: () => async () => undefined }))

const { GET } = await import("./route")
const saved = process.env.CRON_SECRET

beforeEach(() => {
  process.env.CRON_SECRET = "cron-secret"
  execute.mockClear()
  withCronAudit.mockClear()
})
afterEach(() => {
  process.env.CRON_SECRET = saved
})

describe("GET cron health-check", () => {
  it("401 sem o segredo do cron e não executa", async () => {
    const response = await GET(new NextRequest("http://localhost/x"))
    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it("executa sob withCronAudit com a chave literal", async () => {
    const response = await GET(new NextRequest("http://localhost/x", { headers: { authorization: "Bearer cron-secret" } }))
    expect(response.status).toBe(200)
    expect(withCronAudit.mock.calls[0][0]).toEqual({
      cronKey: "payment-provider-health-check",
      cronPath: "/api/v1/payment-provider/cron/health-check",
    })
  })

  it("500 quando o ciclo degrada alguma instância (alerta Slack via withCronAudit)", async () => {
    execute.mockResolvedValueOnce(new Output(false, [], ["degradado"], null))
    const response = await GET(new NextRequest("http://localhost/x", { headers: { authorization: "Bearer cron-secret" } }))
    expect(response.status).toBe(500)
  })
})
