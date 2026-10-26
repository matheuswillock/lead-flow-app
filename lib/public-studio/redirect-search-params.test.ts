import { describe, expect, it } from "bun:test"
import { serializePublicRedirectSearchParams } from "./redirect-search-params"

describe("serializePublicRedirectSearchParams", () => {
  it("preserva tracking e parâmetros repetidos", () => {
    expect(serializePublicRedirectSearchParams({
      cs_el: "contact-123",
      campaignId: "campaign-456",
      dispatchId: "dispatch-789",
      utm_source: "email",
      tag: ["a", "b"],
    })).toBe("?cs_el=contact-123&campaignId=campaign-456&dispatchId=dispatch-789&utm_source=email&tag=a&tag=b")
  })

  it("não adiciona interrogação quando não há parâmetros", () => {
    expect(serializePublicRedirectSearchParams({})).toBe("")
  })
})
