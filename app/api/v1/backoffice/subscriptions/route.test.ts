import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse, after } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}))
mock.module("server-only", () => ({}))

type BackofficeAccessResult =
  | { access: Record<string, unknown>; error?: never; status?: never }
  | { access?: never; error: Output; status: number }

let accessResult: BackofficeAccessResult

mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({
  getBackofficeAccess: mock(async () => accessResult),
}))

const getSummaryMock = mock(async () => new Output(true, [], [], { mrr: 100, partial: false }))

mock.module("@/app/api/useCases/backoffice/BackofficeSubscriptionsPanelUseCase", () => ({
  backofficeSubscriptionsPanelUseCase: { getSummary: getSummaryMock },
}))

const { GET } = await import("./route")

function makeRequest() {
  return new NextRequest("http://localhost/api/v1/backoffice/subscriptions", { method: "GET" })
}

function grantAccess() {
  accessResult = {
    access: {
      supabaseId: "supa-1",
      profileId: "bo-profile-1",
      backofficeUserId: "bo-1",
      backofficeEmail: "dono@corretorstudio.com",
      fullAccess: false,
      isOperator: true,
    },
  }
}

beforeEach(() => {
  getSummaryMock.mockClear()
  grantAccess()
})

describe("GET /backoffice/subscriptions", () => {
  it("acesso de backoffice (mesmo operator) → 200 com o resumo do painel", async () => {
    const response = await GET(makeRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.result.mrr).toBe(100)
    expect(getSummaryMock).toHaveBeenCalled()
  })

  it("sem acesso de backoffice → propaga o erro/status do getBackofficeAccess", async () => {
    accessResult = { error: new Output(false, [], ["Acesso negado"], null), status: 403 }

    const response = await GET(makeRequest())

    expect(response.status).toBe(403)
    expect(getSummaryMock).not.toHaveBeenCalled()
  })
})
