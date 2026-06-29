import { describe, expect, it } from "bun:test"
import { CDP_PRIMARY_SEGMENT_PRIORITY } from "@/lib/cdp/field-catalog"

describe("CDP_PRIMARY_SEGMENT_PRIORITY", () => {
  it("prioriza bloqueio e renovação antes de aptidão", () => {
    expect(CDP_PRIMARY_SEGMENT_PRIORITY[0]).toBe("email_blocked")
    expect(CDP_PRIMARY_SEGMENT_PRIORITY).toContain("portfolio_renewal_due")
    expect(CDP_PRIMARY_SEGMENT_PRIORITY).toContain("email_marketable")
    expect(CDP_PRIMARY_SEGMENT_PRIORITY.indexOf("email_blocked")).toBeLessThan(
      CDP_PRIMARY_SEGMENT_PRIORITY.indexOf("email_marketable")
    )
  })
})
