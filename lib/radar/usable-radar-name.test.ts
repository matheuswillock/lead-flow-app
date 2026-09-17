import { describe, expect, it } from "bun:test"
import { isUsableRadarDisplayName } from "@/lib/radar/usable-radar-name"

describe("isUsableRadarDisplayName", () => {
  it("nome real e preenchido é usável", () => {
    expect(isUsableRadarDisplayName("Maria Silva")).toBe(true)
  })

  it("vazio não é usável", () => {
    expect(isUsableRadarDisplayName("")).toBe(false)
  })

  it("só espaços não é usável", () => {
    expect(isUsableRadarDisplayName("   ")).toBe(false)
  })

  it("null não é usável", () => {
    expect(isUsableRadarDisplayName(null)).toBe(false)
  })

  it("undefined não é usável", () => {
    expect(isUsableRadarDisplayName(undefined)).toBe(false)
  })

  it("placeholder 'Visitante Anônimo' não é usável", () => {
    expect(isUsableRadarDisplayName("Visitante Anônimo")).toBe(false)
  })

  it("nome com cara de e-mail (usado como displayName placeholder) não é usável", () => {
    expect(isUsableRadarDisplayName("kkj@example.com")).toBe(false)
  })

  it("nome com espaços nas pontas é aparado antes de avaliar", () => {
    expect(isUsableRadarDisplayName("  Maria Silva  ")).toBe(true)
  })
})
