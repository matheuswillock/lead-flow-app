import { describe, expect, it } from "bun:test"
import { RADAR_PRIMARY_SEGMENT_PRIORITY } from "@/lib/radar/field-catalog"

describe("RADAR_PRIMARY_SEGMENT_PRIORITY", () => {
  it("prioriza bloqueio e renovação antes de aptidão", () => {
    expect(RADAR_PRIMARY_SEGMENT_PRIORITY[0]).toBe("email_blocked")
    expect(RADAR_PRIMARY_SEGMENT_PRIORITY).toContain("portfolio_renewal_due")
    expect(RADAR_PRIMARY_SEGMENT_PRIORITY).toContain("email_marketable")
    expect(RADAR_PRIMARY_SEGMENT_PRIORITY.indexOf("email_blocked")).toBeLessThan(
      RADAR_PRIMARY_SEGMENT_PRIORITY.indexOf("email_marketable")
    )
  })
})
