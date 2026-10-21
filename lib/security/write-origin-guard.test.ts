import { describe, expect, it } from "bun:test"
import { isSameOriginWrite } from "./write-origin-guard"

function req(headers: Record<string, string>) {
  return new Request("https://app.example.com/api/x", { method: "PUT", headers })
}

describe("isSameOriginWrite", () => {
  it("aceita Origin igual ao host da requisição", () => {
    expect(isSameOriginWrite(req({ origin: "https://app.example.com", host: "app.example.com" }))).toBe(true)
    expect(
      isSameOriginWrite(req({ origin: "https://app.example.com", "x-forwarded-host": "app.example.com", host: "internal" })),
    ).toBe(true)
  })

  it("rejeita Origin de outro site, Origin inválido e ausência sem Sec-Fetch-Site", () => {
    expect(isSameOriginWrite(req({ origin: "https://evil.com", host: "app.example.com" }))).toBe(false)
    expect(isSameOriginWrite(req({ origin: "not a url", host: "app.example.com" }))).toBe(false)
    expect(isSameOriginWrite(req({ host: "app.example.com" }))).toBe(false)
  })

  it("sem Origin, aceita só Sec-Fetch-Site same-origin", () => {
    expect(isSameOriginWrite(req({ "sec-fetch-site": "same-origin" }))).toBe(true)
    expect(isSameOriginWrite(req({ "sec-fetch-site": "cross-site" }))).toBe(false)
  })
})
