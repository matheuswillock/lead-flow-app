import { describe, expect, it } from "bun:test"
import { buildE2eAuthCookie } from "../../e2e/fixtures/auth"

describe("buildE2eAuthCookie", () => {
  it("usa domain/path e não url — Playwright recusa url+path juntos", () => {
    const cookie = buildE2eAuthCookie("token", "http://127.0.0.1:3000")
    expect(cookie.domain).toBe("127.0.0.1")
    expect(cookie.path).toBe("/")
    expect("url" in cookie).toBe(false)
  })
})
