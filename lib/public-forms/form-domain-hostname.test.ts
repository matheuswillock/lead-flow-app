import { describe, expect, it } from "bun:test"
import { validateFormDomainHostname } from "./form-domain-hostname"

describe("validateFormDomainHostname", () => {
  it("aceita subdomínio válido e normaliza para lowercase", () => {
    expect(validateFormDomainHostname("forms.imobiliariax.com.br")).toEqual({
      ok: true,
      hostname: "forms.imobiliariax.com.br",
    })
    expect(validateFormDomainHostname("  Forms.ImobiliariaX.COM.BR  ")).toEqual({
      ok: true,
      hostname: "forms.imobiliariax.com.br",
    })
    expect(validateFormDomainHostname("forms.minha-imob.com")).toEqual({
      ok: true,
      hostname: "forms.minha-imob.com",
    })
  })

  it("rejeita esquema, porta e caminho", () => {
    expect(validateFormDomainHostname("https://forms.imob.com.br").ok).toBe(false)
    expect(validateFormDomainHostname("forms.imob.com.br:443").ok).toBe(false)
    expect(validateFormDomainHostname("forms.imob.com.br/contato").ok).toBe(false)
    expect(validateFormDomainHostname("forms.imob.com.br?x=1").ok).toBe(false)
  })

  it("rejeita domínio raiz (sem subdomínio)", () => {
    expect(validateFormDomainHostname("imobiliariax.com").ok).toBe(false)
  })

  it("rejeita labels inválidos", () => {
    expect(validateFormDomainHostname("").ok).toBe(false)
    expect(validateFormDomainHostname("forms..imob.com").ok).toBe(false)
    expect(validateFormDomainHostname("-forms.imob.com.br").ok).toBe(false)
    expect(validateFormDomainHostname("forms-.imob.com.br").ok).toBe(false)
    expect(validateFormDomainHostname("forms.imob.com.b1").ok).toBe(false)
    expect(validateFormDomainHostname("fo rms.imob.com.br").ok).toBe(false)
    expect(validateFormDomainHostname("user@forms.imob.com.br").ok).toBe(false)
  })
})
