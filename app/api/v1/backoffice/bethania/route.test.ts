import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({ NextRequest, NextResponse }))
let accessResult: any
mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({ getBackofficeAccess: mock(async () => accessResult) }))
const execute = mock(async (_input: unknown) => new Output(true, [], [], { logs: [], page: 1, pageSize: 25, total: 0 }))
mock.module("@/app/api/useCases/backofficeBethania/BackofficeBethaniaUseCase", () => ({
  backofficeBethaniaUseCase: { execute },
}))
const { GET } = await import("./route")
const controlsRoute = await import("./controls/route")
const senderRoute = await import("./sender/route")
const logsRoute = await import("./logs/route")

const access = { access: { profileId: "actor-profile", backofficeUserId: "bo-user", fullAccess: true } }
function request(url: string, method = "GET", body?: unknown) {
  return new NextRequest(url, { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) })
}
beforeEach(() => {
  accessResult = access
  execute.mockClear()
})

describe("Bethânia backoffice routes", () => {
  it("requires backoffice authorization before overview", async () => {
    accessResult = { error: new Output(false, [], ["Não autenticado"], null), status: 401 }
    const response = await GET(request("http://localhost/api/v1/backoffice/bethania"))
    expect(response.status).toBe(401)
    expect(execute).not.toHaveBeenCalled()
  })

  it("passes the authenticated profile as pause actor", async () => {
    const response = await controlsRoute.PATCH(request("http://localhost/api/v1/backoffice/bethania/controls", "PATCH", { scope: "global", paused: true }))
    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({ operation: "set-pause", scope: "global", paused: true, actorProfileId: "actor-profile" })
  })

  it("rejects invalid event pause IDs", async () => {
    execute.mockResolvedValueOnce(new Output(false, [], ["Evento inválido"], { status: 400 }))
    const response = await controlsRoute.PATCH(request("http://localhost/api/v1/backoffice/bethania/controls", "PATCH", { scope: "event", eventType: "bad", paused: true }))
    expect(response.status).toBe(400)
  })

  it("validates and audits sender URL changes with authenticated backoffice profile", async () => {
    const response = await senderRoute.PATCH(request("http://localhost/api/v1/backoffice/bethania/sender", "PATCH", { webhookUrl: "https://sender.example.com/" }))
    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({ operation: "set-sender-url", webhookUrl: "https://sender.example.com/", actorProfileId: "actor-profile" })
  })

  it("rejects malformed sender URL payloads without mutation", async () => {
    const response = await senderRoute.PATCH(request("http://localhost/api/v1/backoffice/bethania/sender", "PATCH", { webhookUrl: 12 }))
    expect(response.status).toBe(400)
    expect(execute).not.toHaveBeenCalled()
  })

  it("passes bounded log filters and pagination", async () => {
    const response = await logsRoute.GET(request("http://localhost/api/v1/backoffice/bethania/logs?eventType=agenda.daily_0700&status=failed&page=3&pageSize=20"))
    expect(response.status).toBe(200)
    expect(execute).toHaveBeenCalledWith({ operation: "list-logs", eventType: "agenda.daily_0700", status: "failed", page: 3, pageSize: 20 })
  })
})
