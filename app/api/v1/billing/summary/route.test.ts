import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"

mock.module("next/server", () => ({ NextRequest, NextResponse, connection: mock(async () => undefined) }))
mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({ rethrowIfPrerenderInterrupted: () => undefined }))
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: { profile: { findUnique: mock() } } }))
mock.module("@/app/api/services/billing/TeamBillingService", () => ({ getBillingSummary: mock() }))

const requireActiveAccountAccess = mock<
  (authenticatedSupabaseId: string) => Promise<NextResponse | null>
>(async () => null)
mock.module("@/app/api/v1/utils/requireActiveAccountAccess", () => ({ requireActiveAccountAccess }))

const { GET } = await import("./route")

beforeEach(() => {
  requireActiveAccountAccess.mockReset()
})

describe("GET /api/v1/billing/summary", () => {
  it("não expõe o resumo para conta pausada", async () => {
    requireActiveAccountAccess.mockResolvedValue(
      NextResponse.json(new Output(false, [], ["O acesso desta conta está pausado."], null), { status: 403 })
    )

    const response = await GET(
      new NextRequest("http://localhost/api/v1/billing/summary", {
        headers: { "x-supabase-user-id": "blocked-user" },
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual(expect.objectContaining({ result: null }))
  })
})
