import { describe, expect, it } from "bun:test"
import { EmailMarketingEligibilityService } from "./EmailMarketingEligibilityService"

describe("EmailMarketingEligibilityService", () => {
  const service = new EmailMarketingEligibilityService()

  it("faz o bloqueio vencer qualquer outro estado", () => {
    expect(service.decide({ isBlocked: true, isComplained: false, isUnsubscribed: false, isBounced: false })).toEqual({ eligible: false, reason: "blocked" })
  })

  it("mantém complaint, unsubscribe e bounce inelegíveis", () => {
    for (const field of ["isComplained", "isUnsubscribed", "isBounced"] as const) {
      expect(service.decide({ isBlocked: false, isComplained: false, isUnsubscribed: false, isBounced: false, [field]: true }).eligible).toBe(false)
    }
  })
})
