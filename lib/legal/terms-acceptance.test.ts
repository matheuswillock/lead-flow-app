import { describe, expect, it } from "bun:test"
import { LEGAL_DOCUMENTS_VERSION } from "./legal-document-types"
import { buildTermsAcceptanceNote, hasTermsAcceptance } from "./terms-acceptance"

describe("hasTermsAcceptance", () => {
  it("aceita somente o booleano true", () => {
    expect(hasTermsAcceptance(true)).toBe(true)
    expect(hasTermsAcceptance(false)).toBe(false)
    expect(hasTermsAcceptance("true")).toBe(false)
    expect(hasTermsAcceptance(1)).toBe(false)
    expect(hasTermsAcceptance(undefined)).toBe(false)
    expect(hasTermsAcceptance(null)).toBe(false)
  })
})

describe("buildTermsAcceptanceNote", () => {
  it("usa a versão vigente por padrão e registra o momento do aceite", () => {
    const note = buildTermsAcceptanceNote("2026-11-23T12:00:00.000Z")

    expect(note).toBe(
      `Aceite dos Termos de Uso, da Política de Privacidade e da Política de Cookies da contratação (versão ${LEGAL_DOCUMENTS_VERSION}) em 2026-11-23T12:00:00.000Z`,
    )
  })
})
