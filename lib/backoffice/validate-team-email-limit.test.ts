import { describe, expect, it } from "bun:test"
import { validateTeamEmailLimitMaxPerDay } from "@/lib/backoffice/validate-team-email-limit"

describe("validateTeamEmailLimitMaxPerDay", () => {
  it("accepts null as unlimited", () => {
    expect(validateTeamEmailLimitMaxPerDay(null)).toBeNull()
  })

  it("rejects invalid numeric limits", () => {
    expect(validateTeamEmailLimitMaxPerDay(0)).toContain("limite diário válido")
    expect(validateTeamEmailLimitMaxPerDay(1.5)).toContain("limite diário válido")
  })

  it("accepts positive integers", () => {
    expect(validateTeamEmailLimitMaxPerDay(5000)).toBeNull()
  })
})
