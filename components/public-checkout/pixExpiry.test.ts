import { describe, expect, it } from "bun:test"
import { isPixExpired } from "./pixExpiry"

const NOW = Date.parse("2026-10-20T12:00:00.000Z")

describe("isPixExpired", () => {
  it("é falso quando a expiração está no futuro", () => {
    expect(isPixExpired("2026-10-20T12:00:01.000Z", NOW)).toBe(false)
  })

  it("é verdadeiro quando a expiração já passou ou é agora", () => {
    expect(isPixExpired("2026-10-20T11:59:59.000Z", NOW)).toBe(true)
    expect(isPixExpired("2026-10-20T12:00:00.000Z", NOW)).toBe(true)
  })

  it("é falso sem data ou com data inválida", () => {
    expect(isPixExpired(null, NOW)).toBe(false)
    expect(isPixExpired(undefined, NOW)).toBe(false)
    expect(isPixExpired("lixo", NOW)).toBe(false)
  })
})
