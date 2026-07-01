import { describe, expect, it } from "bun:test"
import { EmailAnalyticsUseCase } from "./EmailAnalyticsUseCase"

describe("EmailAnalyticsUseCase", () => {
  const useCase = new EmailAnalyticsUseCase()

  it("exposes getAnalytics and getDispatchPreview methods", () => {
    expect(typeof useCase.getAnalytics).toBe("function")
    expect(typeof useCase.getDispatchPreview).toBe("function")
  })
})
