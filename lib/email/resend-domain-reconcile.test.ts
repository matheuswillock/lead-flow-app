import { describe, expect, it } from "bun:test"
import { isResendDomainStatusInSync } from "./resend-domain-reconcile"

describe("isResendDomainStatusInSync", () => {
  it("considera sincronizado quando status é igual", () => {
    expect(isResendDomainStatusInSync("verified", "verified")).toBe(true)
    expect(isResendDomainStatusInSync("partially_failed", "partially_failed")).toBe(true)
  })

  it("detecta dessincronia", () => {
    expect(isResendDomainStatusInSync("verified", "partially_failed")).toBe(false)
    expect(isResendDomainStatusInSync("partially_failed", "verified")).toBe(false)
  })

  it("trata null/undefined como equivalentes", () => {
    expect(isResendDomainStatusInSync(null, undefined)).toBe(true)
    expect(isResendDomainStatusInSync(null, "pending")).toBe(false)
  })
})
