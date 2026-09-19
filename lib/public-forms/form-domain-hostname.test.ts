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

  /**
   * Regressão do achado P2 do codex (PR #1204): a contagem de labels sozinha
   * aceitava um apex brasileiro porque `.com.br` já soma 3 labels. O CNAME
   * emitido apontava `imobiliariax` → `imobiliariax.imobiliariax.com.br`
   * (nunca resolve) e a verificação ficava eternamente pendente.
   */
  it("rejeita apex com sufixo público de múltiplos labels (.com.br, .net.br, .adv.br, .eng.br)", () => {
    expect(validateFormDomainHostname("imobiliariax.com.br").ok).toBe(false)
    expect(validateFormDomainHostname("imobiliariax.net.br").ok).toBe(false)
    expect(validateFormDomainHostname("imobiliariax.adv.br").ok).toBe(false)
    expect(validateFormDomainHostname("imobiliariax.eng.br").ok).toBe(false)
  })

  it("aceita subdomínio de apex com sufixo público de múltiplos labels", () => {
    expect(validateFormDomainHostname("forms.imobiliariax.adv.br")).toEqual({
      ok: true,
      hostname: "forms.imobiliariax.adv.br",
    })
    expect(validateFormDomainHostname("forms.imobiliariax.eng.br")).toEqual({
      ok: true,
      hostname: "forms.imobiliariax.eng.br",
    })
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
