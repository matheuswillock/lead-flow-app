import { describe, expect, it } from "bun:test"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"

function makeAccess(isOperator: boolean): BackofficeAccess {
  return {
    supabaseId: "supabase-1",
    profileId: "profile-1",
    backofficeUserId: "bo-1",
    backofficeEmail: "user@test.com",
    fullAccess: !isOperator,
    isOperator,
  }
}

describe("requireManagerAccess", () => {
  it("retorna 403 para operator", () => {
    const response = requireManagerAccess(makeAccess(true))
    expect(response).not.toBeNull()
    expect(response?.status).toBe(403)
  })

  it("permite manager (não-operator)", () => {
    expect(requireManagerAccess(makeAccess(false))).toBeNull()
  })
})
