import { describe, expect, it } from "bun:test"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"

function makeAccess(isOperator: boolean): BackofficeAccess {
  return {
    profileId: "profile-1",
    backofficeUserId: "bo-1",
    email: "user@test.com",
    fullName: "User",
    isOperator,
    isActive: true,
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
