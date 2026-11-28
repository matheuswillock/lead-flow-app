import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

const getUser = mock(async () => ({ data: { user: { id: "owner-id" } } }))
const createSupabaseServer = mock(async () => ({ auth: { getUser } }))
mock.module("@/lib/supabase/server", () => ({ createSupabaseServer }))

const { assertProfileOwnership } = await import("./assertProfileOwnership")

function request(identityHeader?: string) {
  const headers = new Headers()
  if (identityHeader) headers.set("x-supabase-user-id", identityHeader)
  return new NextRequest("http://localhost/api", { headers })
}

beforeEach(() => {
  getUser.mockClear()
  createSupabaseServer.mockClear()
})

describe("assertProfileOwnership", () => {
  it("does not trust an identity header without a Supabase session", async () => {
    createSupabaseServer.mockResolvedValueOnce(null as any)

    const result = await assertProfileOwnership(request("owner-id"), "owner-id")

    expect(result).toMatchObject({ status: 401 })
    expect(getUser).not.toHaveBeenCalled()
  })

  it("uses the authenticated Supabase user as the only identity", async () => {
    const result = await assertProfileOwnership(request("attacker-id"), "owner-id")

    expect(result).toMatchObject({ supabaseId: "owner-id" })
    expect(getUser).toHaveBeenCalledTimes(1)
  })
})
