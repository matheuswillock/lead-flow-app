import { beforeEach, describe, expect, it } from "bun:test"
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
  resetPublicFormRateLimitsForTests,
} from "./rate-limit"

describe("rate limit de formulários públicos", () => {
  beforeEach(resetPublicFormRateLimitsForTests)

  it("bloqueia após o limite da janela", async () => {
    expect(
      (await consumePublicFormRateLimit("form:a", { limit: 1, windowMs: 60_000 })).allowed,
    ).toBe(true)
    expect(
      (await consumePublicFormRateLimit("form:a", { limit: 1, windowMs: 60_000 })).allowed,
    ).toBe(false)
  })

  it("usa apenas o primeiro endereço encaminhado como fingerprint efêmero", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    })
    expect(publicFormRequestFingerprint(request)).toBe("203.0.113.10")
  })

  it("combina IP + visitorSessionId no fingerprint quando fornecido (achado #3: IP sozinho é contornável)", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    })
    expect(publicFormRequestFingerprint(request, "vs-abc123")).toBe("203.0.113.10:vs-abc123")
    expect(publicFormRequestFingerprint(request)).toBe("203.0.113.10")
  })
})
