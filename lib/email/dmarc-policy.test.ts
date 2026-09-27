import { describe, expect, it } from "bun:test"
import { normalizeDmarcReport, resolveDmarcStatus } from "./dmarc-policy"

describe("dmarc-policy", () => {
  it("classifica relatório alinhado", () => expect(resolveDmarcStatus({ domain: "mail.example.com", totalMessages: 100, alignedMessages: 99, passRate: 0.99, reportedAt: "2026-09-26" })).toBe("aligned"))
  it("classifica relatório abaixo do mínimo como falho", () => expect(resolveDmarcStatus({ domain: "mail.example.com", totalMessages: 100, alignedMessages: 80, passRate: 0.8, reportedAt: "2026-09-26" })).toBe("failed"))
  it("normaliza payload e rejeita valores impossíveis", () => {
    expect(normalizeDmarcReport({ domain: " Mail.Example.COM ", totalMessages: 10, alignedMessages: 10 }).domain).toBe("mail.example.com")
    expect(() => normalizeDmarcReport({ domain: "x", totalMessages: 1, alignedMessages: 2 })).toThrow()
  })
})
