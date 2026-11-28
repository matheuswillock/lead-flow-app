import { describe, expect, it } from "bun:test"
import {
  canRequestWhatsAppCode,
  isWhatsAppChallengeUsable,
} from "./verification-policy"

const now = new Date("2026-11-23T16:00:00.000Z")

function challenge(overrides: Partial<{
  expiresAt: Date
  attempts: number
  consumedAt: Date | null
}> = {}) {
  return {
    expiresAt: new Date(now.getTime() + 60_000),
    attempts: 0,
    consumedAt: null,
    ...overrides,
  }
}

describe("WhatsApp verification policy", () => {
  it("allows a request when fewer than three codes were sent in the previous hour", () => {
    const sentAt = [
      new Date(now.getTime() - 20 * 60_000),
      new Date(now.getTime() - 10 * 60_000),
    ]

    expect(canRequestWhatsAppCode(sentAt, now)).toBe(true)
  })

  it("blocks a fourth code request inside the rolling hour", () => {
    const sentAt = [
      new Date(now.getTime() - 50 * 60_000),
      new Date(now.getTime() - 30 * 60_000),
      new Date(now.getTime() - 5 * 60_000),
    ]

    expect(canRequestWhatsAppCode(sentAt, now)).toBe(false)
  })

  it("ignores requests older than the rolling-hour window", () => {
    const sentAt = [new Date(now.getTime() - 60 * 60_000 - 1)]

    expect(canRequestWhatsAppCode(sentAt, now)).toBe(true)
  })

  it("accepts an unexpired challenge with fewer than five attempts", () => {
    expect(isWhatsAppChallengeUsable(challenge(), now)).toBe(true)
  })

  it("rejects an expired, consumed, or exhausted challenge", () => {
    expect(isWhatsAppChallengeUsable(challenge({ expiresAt: now }), now)).toBe(false)
    expect(isWhatsAppChallengeUsable(challenge({ consumedAt: now }), now)).toBe(false)
    expect(isWhatsAppChallengeUsable(challenge({ attempts: 5 }), now)).toBe(false)
  })
})
