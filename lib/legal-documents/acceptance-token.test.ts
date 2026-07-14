import { describe, expect, it } from "bun:test"
import { acceptanceTokenExpiry, acceptanceTokenPreview, generateAcceptanceToken, hashAcceptanceToken } from "./acceptance-token"

describe("acceptance token", () => {
  it("gera 256 bits e persiste apenas um hash determinístico", () => {
    const token = generateAcceptanceToken()
    expect(Buffer.from(token, "base64url")).toHaveLength(32)
    expect(hashAcceptanceToken(token)).toHaveLength(64)
    expect(hashAcceptanceToken(token)).toBe(hashAcceptanceToken(token))
    expect(hashAcceptanceToken(token)).not.toContain(token)
  })

  it("cria preview não reversível e expiração de sete dias", () => {
    const token = generateAcceptanceToken()
    expect(acceptanceTokenPreview(token)).not.toBe(token)
    const now = new Date("2026-07-14T12:00:00.000Z")
    expect(acceptanceTokenExpiry(now).toISOString()).toBe("2026-07-21T12:00:00.000Z")
  })
})
