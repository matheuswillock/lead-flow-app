import { describe, expect, it } from "bun:test"
import { suggestFormDomainHostname } from "./suggest-form-domain-hostname"

describe("suggestFormDomainHostname", () => {
  it("troca o subdomínio técnico do domínio de envio por forms.", () => {
    expect(suggestFormDomainHostname("mail.imobiliariax.com.br")).toBe(
      "forms.imobiliariax.com.br",
    )
    expect(suggestFormDomainHostname("mail.imobiliariax.com")).toBe("forms.imobiliariax.com")
    expect(suggestFormDomainHostname("envio.minhaempresa.com.br")).toBe(
      "forms.minhaempresa.com.br",
    )
  })

  it("prefixa forms. quando o domínio de envio é o apex", () => {
    expect(suggestFormDomainHostname("imobiliariax.com.br")).toBe("forms.imobiliariax.com.br")
    expect(suggestFormDomainHostname("imobiliariax.com")).toBe("forms.imobiliariax.com")
  })

  it("retorna null para entrada inválida", () => {
    expect(suggestFormDomainHostname("")).toBeNull()
    expect(suggestFormDomainHostname("sem-ponto")).toBeNull()
    expect(suggestFormDomainHostname("a..b")).toBeNull()
  })
})
