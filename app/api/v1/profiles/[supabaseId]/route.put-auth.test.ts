import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}))
mock.module("server-only", () => ({}))
let authenticatedUserId: string | null = null
const getUser = mock(async () => ({
  data: { user: authenticatedUserId ? { id: authenticatedUserId } : null },
}))
mock.module("@/lib/supabase/server", () => ({
  createSupabaseServer: mock(async () => ({ auth: { getUser } })),
  createSupabaseAdmin: mock(() => null),
  createSupabaseAdminClient: mock(() => null),
}))

const updateProfileMock = mock(async () => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { id: "profile-1" },
}))
mock.module("@/app/api/useCases/profiles/ProfileUseCase", () => ({
  RegisterNewUserProfile: class {
    updateProfile = updateProfileMock
  },
}))

const { PUT } = await import("./route")
const profileId = "11111111-1111-4111-8111-111111111111"
const otherId = "22222222-2222-4222-8222-222222222222"
const params = Promise.resolve({ supabaseId: profileId })

function request(identity?: string) {
  const headers = new Headers({ "content-type": "application/json" })
  if (identity) headers.set("x-supabase-user-id", identity)
  return new NextRequest(`http://localhost/api/v1/profiles/${profileId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ fullName: "Nome Atualizado" }),
  })
}

beforeEach(() => {
  updateProfileMock.mockClear()
  authenticatedUserId = null
})

describe("PUT /api/v1/profiles/[supabaseId] ownership", () => {
  it("rejects an unauthenticated request before updating the profile", async () => {
    const response = await PUT(request(), { params })

    expect(response.status).toBe(401)
    expect(updateProfileMock).not.toHaveBeenCalled()
  })

  it("rejects a different profile before updating the profile", async () => {
    authenticatedUserId = otherId
    const response = await PUT(request(profileId), { params })

    expect(response.status).toBe(403)
    expect(updateProfileMock).not.toHaveBeenCalled()
  })

  it("allows the authenticated owner to update the profile", async () => {
    authenticatedUserId = profileId
    const response = await PUT(request(otherId), { params })

    expect(response.status).toBe(200)
    expect(updateProfileMock).toHaveBeenCalledWith(
      profileId,
      expect.objectContaining({
        fullName: "Nome Atualizado",
      }),
    )
  })
})
