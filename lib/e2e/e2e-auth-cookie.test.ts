import { describe, expect, it } from "bun:test"
import { buildE2eAddCookiesPayload, buildE2eAuthCookie } from "../../e2e/fixtures/auth"

describe("buildE2eAuthCookie", () => {
  it("usa domain/path e não url — storageState aceita o par", () => {
    const cookie = buildE2eAuthCookie("token", "http://127.0.0.1:3000")
    expect(cookie.domain).toBe("127.0.0.1")
    expect(cookie.path).toBe("/")
    expect("url" in cookie).toBe(false)
  })
})

describe("buildE2eAddCookiesPayload", () => {
  it("usa só url — Playwright recusa url+path e url+domain", () => {
    const cookie = buildE2eAddCookiesPayload("token", "http://127.0.0.1:3000")
    expect(cookie.url).toBe("http://127.0.0.1:3000/")
    expect("path" in cookie).toBe(false)
    expect("domain" in cookie).toBe(false)
  })
})
