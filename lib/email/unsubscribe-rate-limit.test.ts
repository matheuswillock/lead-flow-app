import { describe, expect, it } from "bun:test"
import {
  checkAndRegisterUnsubscribeRateLimit,
  UNSUBSCRIBE_RATE_LIMIT_CONFIG,
} from "./unsubscribe-rate-limit"

describe("checkAndRegisterUnsubscribeRateLimit", () => {
  it("permite até o máximo de tentativas por IP", () => {
    const ip = `test-ip-${Date.now()}-${Math.random()}`
    const { maxAttempts } = UNSUBSCRIBE_RATE_LIMIT_CONFIG

    for (let i = 0; i < maxAttempts; i += 1) {
      const result = checkAndRegisterUnsubscribeRateLimit(ip)
      expect(result.allowed).toBe(true)
    }

    const blocked = checkAndRegisterUnsubscribeRateLimit(ip)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })
})
