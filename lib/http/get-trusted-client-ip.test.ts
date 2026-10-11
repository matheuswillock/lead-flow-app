import { describe, expect, it } from "bun:test"
import { getTrustedClientIp } from "./get-trusted-client-ip"

describe("getTrustedClientIp", () => {
  it("prefere o endereço assinado pela infraestrutura Vercel", () => {
    const headers = new Headers({
      "x-vercel-id": "gru1::iad1::request-id",
      "x-vercel-forwarded-for": "198.51.100.4",
      "x-forwarded-for": "203.0.113.7",
    })
    expect(getTrustedClientIp(headers, { VERCEL: "1", NODE_ENV: "production" })).toBe("198.51.100.4")
  })

  it("rejeita x-vercel-forwarded-for sem o contexto da infraestrutura", () => {
    const headers = new Headers({ "x-vercel-forwarded-for": "198.51.100.4" })
    expect(getTrustedClientIp(headers, { VERCEL: "1", NODE_ENV: "production" })).toBeNull()
    expect(getTrustedClientIp(headers, { NODE_ENV: "production" })).toBeNull()
  })

  it("rejeita fallback de proxy em produção fora da Vercel", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" })
    expect(getTrustedClientIp(headers, { NODE_ENV: "production" })).toBeNull()
  })

  it("permite fallback validado apenas em desenvolvimento e teste", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })
    expect(getTrustedClientIp(headers, { NODE_ENV: "development" })).toBe("203.0.113.7")
    expect(getTrustedClientIp(headers, { NODE_ENV: "test" })).toBe("203.0.113.7")
  })
})
