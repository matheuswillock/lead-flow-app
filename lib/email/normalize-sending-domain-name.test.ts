import { describe, expect, it } from "bun:test"
import { normalizeSendingDomainName } from "./normalize-sending-domain-name"

describe("normalizeSendingDomainName", () => {
  it("remove protocolo, barra final, espaços e caixa alta", () => {
    expect(normalizeSendingDomainName("  HTTP://Suitseguros.COM.br/  ")).toBe(
      "suitseguros.com.br"
    )
    expect(normalizeSendingDomainName("https://dominio.com.br")).toBe("dominio.com.br")
  })

  it("descarta o caminho depois do host", () => {
    expect(normalizeSendingDomainName("https://dominio.com.br/planos/2026")).toBe(
      "dominio.com.br"
    )
  })

  it("preserva domínio já limpo", () => {
    expect(normalizeSendingDomainName("dominio.com.br")).toBe("dominio.com.br")
    expect(normalizeSendingDomainName("mail.dominio.com.br")).toBe("mail.dominio.com.br")
  })

  it("devolve vazio quando não sobra host", () => {
    expect(normalizeSendingDomainName("https:// /")).toBe("")
    expect(normalizeSendingDomainName("   ")).toBe("")
  })
})
