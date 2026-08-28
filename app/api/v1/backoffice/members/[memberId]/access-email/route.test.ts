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

const sendAccessEmailMock = mock(
  async (_profileId: string, _mode: string) =>
    new Output(true, ["Convite reenviado com sucesso."], [], { email: "ana@example.com" })
)
const generateInviteLinkMock = mock(
  async (_profileId: string) =>
    new Output(true, ["Link de convite gerado."], [], {
      actionLink: "https://app.local/set-password?token=NEW",
      email: "ana@example.com",
    })
)

mock.module("@/app/api/useCases/backoffice/BackofficeMemberAccessEmailUseCase", () => ({
  backofficeMemberAccessEmailUseCase: {
    sendAccessEmail: sendAccessEmailMock,
    generateInviteLink: generateInviteLinkMock,
  },
}))

const { POST } = await import("./route")

const params = Promise.resolve({ memberId: "profile-1" })

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/backoffice/members/profile-1/access-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function grantManagerAccess() {
  accessResult = {
    access: {
      supabaseId: "supa-1",
      profileId: "bo-profile-1",
      backofficeUserId: "bo-1",
      backofficeEmail: "dono@corretorstudio.com",
      fullAccess: true,
      isOperator: false,
    },
  }
}

function grantOperatorAccess() {
  accessResult = {
    access: {
      supabaseId: "supa-2",
      profileId: "bo-profile-2",
      backofficeUserId: "bo-2",
      backofficeEmail: "operador@corretorstudio.com",
      fullAccess: false,
      isOperator: true,
    },
  }
}

beforeEach(() => {
  sendAccessEmailMock.mockClear()
  generateInviteLinkMock.mockClear()
  grantManagerAccess()
})

describe("POST /access-email — deliver=link (Entregável 3)", () => {
  it("deliver: 'link' com acesso de manager → chama generateInviteLink, devolve actionLink", async () => {
    const response = await POST(makeRequest({ mode: "invite", deliver: "link" }), { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(generateInviteLinkMock).toHaveBeenCalledWith("profile-1")
    expect(sendAccessEmailMock).not.toHaveBeenCalled()
    expect(json.result.actionLink).toBe("https://app.local/set-password?token=NEW")
  })

  it("deliver: 'link' com acesso de operator → 403, use case nunca é chamado", async () => {
    grantOperatorAccess()

    const response = await POST(makeRequest({ mode: "invite", deliver: "link" }), { params })

    expect(response.status).toBe(403)
    expect(generateInviteLinkMock).not.toHaveBeenCalled()
    expect(sendAccessEmailMock).not.toHaveBeenCalled()
  })

  it("sem deliver (default) continua chamando sendAccessEmail — comportamento existente não quebra", async () => {
    const response = await POST(makeRequest({ mode: "invite" }), { params })

    expect(response.status).toBe(200)
    expect(sendAccessEmailMock).toHaveBeenCalledWith("profile-1", "invite")
    expect(generateInviteLinkMock).not.toHaveBeenCalled()
  })

  it("deliver: 'email' explícito também chama sendAccessEmail", async () => {
    const response = await POST(makeRequest({ mode: "invite", deliver: "email" }), { params })

    expect(response.status).toBe(200)
    expect(sendAccessEmailMock).toHaveBeenCalledWith("profile-1", "invite")
  })
})
