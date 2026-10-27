import { describe, expect, it } from "bun:test"
import { normalizeBackofficeMeetingLink } from "./normalizeBackofficeMeetingLink"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1d — achado da revisão (R13d-4):
 * `BackofficeLeadUseCase` (createLead/updateLead/updateLeadStatus) gravava
 * `meetingLink` só com `trimOrNull`, aceitando `javascript:` e `http:`.
 *
 * Controle negativo: trocar o corpo da função por
 * `return { isValid: true, value: trimOrNull(value) }` (comportamento antigo)
 * faz os testes de `javascript:`, `http:` novo e tipo inválido falharem.
 */
describe("normalizeBackofficeMeetingLink — só https (SPEC 13, A-E1d, R13d-4)", () => {
  it("aceita link https e devolve o valor aparado", () => {
    expect(normalizeBackofficeMeetingLink("  https://meet.google.com/abc-defg-hij  ")).toEqual({
      isValid: true,
      value: "https://meet.google.com/abc-defg-hij",
    })
  })

  it("recusa esquema javascript:", () => {
    const result = normalizeBackofficeMeetingLink("javascript:document.location=document.cookie")
    expect(result.isValid).toBe(false)
  })

  it("recusa javascript: mesmo quando é o valor já gravado", () => {
    const stored = "javascript:void(0)"
    expect(normalizeBackofficeMeetingLink(stored, stored).isValid).toBe(false)
  })

  it("recusa link http novo", () => {
    const result = normalizeBackofficeMeetingLink("http://meet.google.com/abc-defg-hij")
    expect(result.isValid).toBe(false)
  })

  it("aceita http legado só quando é exatamente o link já gravado", () => {
    const stored = "http://meet.google.com/abc-defg-hij"
    expect(normalizeBackofficeMeetingLink(stored, stored)).toEqual({ isValid: true, value: stored })
    expect(
      normalizeBackofficeMeetingLink("http://meet.google.com/outro-link", stored).isValid
    ).toBe(false)
  })

  it("vazio ou nulo limpa o link", () => {
    expect(normalizeBackofficeMeetingLink(null)).toEqual({ isValid: true, value: null })
    expect(normalizeBackofficeMeetingLink("   ")).toEqual({ isValid: true, value: null })
  })

  it("recusa tipo que não é string", () => {
    expect(normalizeBackofficeMeetingLink(42).isValid).toBe(false)
  })
})
