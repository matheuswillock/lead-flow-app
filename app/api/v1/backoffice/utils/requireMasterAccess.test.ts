import { describe, expect, it } from "bun:test"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
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

describe("requireMasterAccess", () => {
  it("retorna 403 para operator", () => {
    const response = requireMasterAccess(makeAccess(true))
    expect(response).not.toBeNull()
    expect(response?.status).toBe(403)
  })

  it("permite master (não-operator)", () => {
    expect(requireMasterAccess(makeAccess(false))).toBeNull()
  })
})
