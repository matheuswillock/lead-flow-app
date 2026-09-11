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

const updatePermanentSubscriptionMock = mock(
  async (_targetSupabaseId: string, hasPermanentSubscription: boolean, _actorProfileId: string) =>
    new Output(true, ["Assinatura permanente atualizada com sucesso"], [], {
      id: "profile-1",
      email: "cliente@example.com",
      fullName: "Cliente Teste",
      hasPermanentSubscription,
    })
)

mock.module("@/app/api/useCases/profiles/UpdatePermanentSubscriptionUseCase", () => ({
  UpdatePermanentSubscriptionUseCase: mock().mockImplementation(() => ({
    updatePermanentSubscription: updatePermanentSubscriptionMock,
  })),
}))

mock.module("@/app/api/infra/data/repositories/profile/ProfileRepository", () => ({
  profileRepository: {},
}))

const { PUT } = await import("./route")

const params = Promise.resolve({ supabaseId: "supa-target-1" })

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/profiles/supa-target-1/permanent-subscription", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function grantManagerAccess() {
  accessResult = {
    access: {
      supabaseId: "supa-actor-1",
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
      supabaseId: "supa-actor-2",
      profileId: "bo-profile-2",
      backofficeUserId: "bo-2",
      backofficeEmail: "operador@corretorstudio.com",
      fullAccess: false,
      isOperator: true,
    },
  }
}

beforeEach(() => {
  updatePermanentSubscriptionMock.mockClear()
  grantManagerAccess()
})

describe("PUT /permanent-subscription — T-50.1 (S1: escalação de privilégio)", () => {
  it("operador de backoffice sem fullAccess → 403 e o use case NÃO é invocado", async () => {
    grantOperatorAccess()

    const response = await PUT(makeRequest({ hasPermanentSubscription: true }), { params })

    expect(response.status).toBe(403)
    expect(updatePermanentSubscriptionMock).not.toHaveBeenCalled()
  })
})

describe("PUT /permanent-subscription — T-50.2 (regressão: manager segue funcionando)", () => {
  it("manager (fullAccess) → 200 com body válido, use case invocado", async () => {
    const response = await PUT(makeRequest({ hasPermanentSubscription: true }), { params })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(updatePermanentSubscriptionMock).toHaveBeenCalledWith(
      "supa-target-1",
      true,
      "bo-profile-1"
    )
    expect(json.result.hasPermanentSubscription).toBe(true)
  })

  it("manager com hasPermanentSubscription não-boolean → 400, use case não invocado", async () => {
    const response = await PUT(makeRequest({ hasPermanentSubscription: "yes" }), { params })

    expect(response.status).toBe(400)
    expect(updatePermanentSubscriptionMock).not.toHaveBeenCalled()
  })
})
