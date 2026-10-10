import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

mock.module("next/server", () => ({ NextRequest, NextResponse, connection: mock(async () => undefined) }))
mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({ rethrowIfPrerenderInterrupted: () => undefined }))

const getSubscription = mock(async () => ({ isValid: true, result: { invoiceUrl: "secret" } }))
mock.module("@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase", () => ({
  subscriptionManagementUseCase: { getSubscription },
}))

const requireActiveAccountAccess = mock<
  (authenticatedSupabaseId: string) => Promise<NextResponse | null>
>(async () => null)
mock.module("@/app/api/v1/utils/requireActiveAccountAccess", () => ({ requireActiveAccountAccess }))

const { GET } = await import("./route")

beforeEach(() => {
  getSubscription.mockReset()
  requireActiveAccountAccess.mockReset()
  requireActiveAccountAccess.mockResolvedValue(
    NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["O acesso desta conta está pausado."], result: null },
      { status: 403 }
    )
  )
})

describe("GET /api/v1/subscription-management", () => {
  it("não consulta nem expõe a assinatura de conta pausada", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/v1/subscription-management", {
        headers: { "x-supabase-user-id": "blocked-user" },
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ result: null }))
    expect(getSubscription).not.toHaveBeenCalled()
  })
})
