import { describe, expect, it } from "bun:test"
import { sanitizePublicFormOrigin } from "./origin"

describe("sanitizePublicFormOrigin", () => {
  it("remove query strings, fragmentos e tokens com possível PII", () => {
    expect(
      sanitizePublicFormOrigin({
        source: "instagram",
        utmCampaign: "pessoa@example.com",
        landingUrl: "https://example.com/forms/abc?email=pessoa@example.com#dados",
        referrer: "https://social.example/post/1?phone=11999999999",
      }),
    ).toEqual({
      source: "instagram",
      landingUrl: "https://example.com/forms/abc",
      referrer: "https://social.example/post/1",
    })
  })

  it("ignora URLs inválidas", () => {
    expect(sanitizePublicFormOrigin({ landingUrl: "não é url" })).toEqual({})
  })
})
