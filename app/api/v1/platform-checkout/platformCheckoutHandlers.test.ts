import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"
import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  handleCreatePlatformCheckout,
  handleGetPlatformCheckout,
  type PlatformCheckoutHandlerDeps,
} from "./platformCheckoutHandlers"

const managerAccess = {
  supabaseId: "sb-owner",
  teamId: "team-1",
  profileId: "profile-owner",
  teamMember: { role: "manager", functions: [] },
} as unknown as TeamAccess

const memberAccess = {
  ...managerAccess,
  teamMember: { role: "member", functions: [] },
} as unknown as TeamAccess

const subscribeMock = mock(
  async (..._args: unknown[]) =>
    new Output(true, [], [], { checkoutId: "purchase-1", checkoutUrl: "/addon-checkout/purchase-1" }),
)
const getOwnerDetailsMock = mock(async (checkoutId: string, ownerProfileId: string) =>
  ownerProfileId === "profile-owner"
    ? new Output(true, [], [], { checkoutId, amount: 375 })
    : new Output(false, [], ["Checkout não encontrado"], null),
)

function buildDeps(overrides: Partial<PlatformCheckoutHandlerDeps> = {}): PlatformCheckoutHandlerDeps {
  return {
    getTeamAccess: async () => ({ access: managerAccess }),
    getAuthenticatedSupabaseId: async () => ({ supabaseId: "sb-owner" }),
    findProfileIdBySupabaseId: async (supabaseId) =>
      supabaseId === "sb-owner" ? "profile-owner" : supabaseId === "sb-other" ? "profile-other" : null,
    subscribeEmailCredits: subscribeMock as never,
    getCheckoutDetailsForOwner: getOwnerDetailsMock,
    ...overrides,
  }
}

const unauthenticated = {
  error: new Output(false, [], ["Não autenticado"], null),
  status: 401,
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/platform-checkout", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST platform-checkout", () => {
  beforeEach(() => {
    subscribeMock.mockClear()
    getOwnerDetailsMock.mockClear()
  })

  it("anônimo recebe 401 e nada é criado", async () => {
    const deps = buildDeps({ getTeamAccess: async () => unauthenticated })

    const response = await handleCreatePlatformCheckout(
      postRequest({ productSlug: "email-credits-upgrade", billingType: "PIX" }),
      deps,
    )

    expect(response.status).toBe(401)
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  it("usuário sem papel de manager recebe 403", async () => {
    const deps = buildDeps({ getTeamAccess: async () => ({ access: memberAccess }) })

    const response = await handleCreatePlatformCheckout(
      postRequest({ productSlug: "email-credits-upgrade", billingType: "PIX" }),
      deps,
    )

    expect(response.status).toBe(403)
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  it("profileId, teamId e amount do body são ignorados: preço e dono vêm do servidor", async () => {
    const response = await handleCreatePlatformCheckout(
      postRequest({
        productSlug: "email-credits-upgrade",
        billingType: "PIX",
        amount: 0.01,
        profileId: "profile-vitima",
        teamId: "team-vitima",
      }),
      buildDeps(),
    )

    expect(response.status).toBe(200)
    expect(subscribeMock).toHaveBeenCalledWith("upgrade", managerAccess, "PIX")
  })

  it("produto sem preço no servidor é recusado", async () => {
    const response = await handleCreatePlatformCheckout(
      postRequest({ productSlug: "radar-managed", billingType: "PIX", amount: 1 }),
      buildDeps(),
    )

    expect(response.status).toBe(400)
    expect(subscribeMock).not.toHaveBeenCalled()
  })

  it("billingType inválido é recusado", async () => {
    const response = await handleCreatePlatformCheckout(
      postRequest({ productSlug: "email-credits-upgrade", billingType: "BOLETO" }),
      buildDeps(),
    )

    expect(response.status).toBe(400)
    expect(subscribeMock).not.toHaveBeenCalled()
  })
})

describe("GET platform-checkout/[checkoutId]", () => {
  beforeEach(() => {
    getOwnerDetailsMock.mockClear()
  })

  it("anônimo recebe 401", async () => {
    const deps = buildDeps({ getAuthenticatedSupabaseId: async () => unauthenticated })

    const response = await handleGetPlatformCheckout(new NextRequest("http://localhost/x"), "purchase-1", deps)

    expect(response.status).toBe(401)
    expect(getOwnerDetailsMock).not.toHaveBeenCalled()
  })

  it("outro usuário autenticado recebe 404", async () => {
    const deps = buildDeps({ getAuthenticatedSupabaseId: async () => ({ supabaseId: "sb-other" }) })

    const response = await handleGetPlatformCheckout(new NextRequest("http://localhost/x"), "purchase-1", deps)

    expect(response.status).toBe(404)
  })

  it("dono recebe 200 com os detalhes", async () => {
    const response = await handleGetPlatformCheckout(new NextRequest("http://localhost/x"), "purchase-1", buildDeps())

    expect(response.status).toBe(200)
    expect(getOwnerDetailsMock).toHaveBeenCalledWith("purchase-1", "profile-owner")
    const body = (await response.json()) as { result: { checkoutId: string } }
    expect(body.result.checkoutId).toBe("purchase-1")
  })

  it("sessão sem profile recebe 404", async () => {
    const deps = buildDeps({ getAuthenticatedSupabaseId: async () => ({ supabaseId: "sb-fantasma" }) })

    const response = await handleGetPlatformCheckout(new NextRequest("http://localhost/x"), "purchase-1", deps)

    expect(response.status).toBe(404)
  })
})
