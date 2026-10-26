import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const access = {
  profileId: "profile-1",
  teamId: "team-1",
  teamMember: { role: "manager", functions: [] },
}
const getTeamAccess = mock(async () => ({ access }))
const execute = mock(
  async () =>
    new Output(true, ["Tentativa de reenvio registrada"], [], {
      ok: false,
      statusCode: 503,
      errorMessage: "HTTP 503",
    }),
)

mock.module("@/app/api/v1/utils/teamAccess", () => ({ getTeamAccess }))
mock.module("@/app/api/useCases/integrations/webhooks/ResendWebhookLogUseCase", () => ({
  resendWebhookLogUseCase: { execute },
}))

const { POST } = await import("./route")

const context = {
  params: Promise.resolve({ id: "webhook-1", logId: "log-1" }),
}

beforeEach(() => {
  getTeamAccess.mockReset()
  getTeamAccess.mockResolvedValue({ access })
  execute.mockClear()
})

describe("POST /integrations/webhooks/[id]/logs/[logId]/resend", () => {
  test("registra a tentativa e responde 200 mesmo quando o destino falha", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/v1/integrations/webhooks/webhook-1/logs/log-1/resend", {
        method: "POST",
      }),
      context,
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result).toEqual({ ok: false, statusCode: 503, errorMessage: "HTTP 503" })
    expect(execute).toHaveBeenCalledWith(access, "webhook-1", "log-1")
  })

  test("bloqueia membros que não são managers", async () => {
    getTeamAccess.mockResolvedValueOnce({
      access: { ...access, teamMember: { role: "operator", functions: [] } },
    } as never)

    const response = await POST(
      new NextRequest("http://localhost/api/v1/integrations/webhooks/webhook-1/logs/log-1/resend", {
        method: "POST",
      }),
      context,
    )

    expect(response.status).toBe(403)
    expect(execute).not.toHaveBeenCalled()
  })
})
