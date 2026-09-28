import { describe, expect, it } from "bun:test"
import { studioHostnameFromEmailDomain } from "./studio-domain-hostname"

describe("studioHostnameFromEmailDomain", () => {
  it("prefixa studio ao domínio de envio", () => {
    expect(studioHostnameFromEmailDomain("mail.marcacliente.com.br")).toBe("studio.mail.marcacliente.com.br")
  })

  it("normaliza caixa e ponto final", () => {
    expect(studioHostnameFromEmailDomain("MarcaCliente.com.br.")).toBe("studio.marcacliente.com.br")
  })

  it("recusa valores que não são hostname", () => {
    expect(studioHostnameFromEmailDomain("https://marcacliente.com.br")).toBeNull()
    expect(studioHostnameFromEmailDomain(null)).toBeNull()
  })
})
