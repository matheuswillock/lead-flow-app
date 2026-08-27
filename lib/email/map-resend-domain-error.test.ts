import { describe, expect, it } from "bun:test"
import { mapResendDomainError } from "./map-resend-domain-error"

describe("mapResendDomainError", () => {
  it("traduz domínio registrado em outro time sem expor API ou links", () => {
    const raw =
      "The cheffia.com domain is registered to another team. You can claim it using the Domain Claim API. See https://resend.com/docs/api-reference/domains/claim-domain."

    const result = mapResendDomainError(raw, "connect", "cheffia.com")

    expect(result).toContain("cheffia.com")
    expect(result).toContain("vinculado a outra conta")
    expect(result).toContain("suporte do Corretor Studio")
    expect(result).not.toContain("Resend")
    expect(result).not.toContain("API")
    expect(result).not.toContain("http")
  })

  it("reconhece variação domain claim", () => {
    const result = mapResendDomainError(
      "Use the Domain Claim API to transfer ownership",
      "connect",
      "exemplo.com"
    )

    expect(result).toContain("exemplo.com")
    expect(result).toContain("transferência")
  })

  it("traduz domínio já cadastrado", () => {
    const result = mapResendDomainError("Domain already exists", "connect")

    expect(result).toBe(
      "Este domínio já está cadastrado. Verifique se não foi conectado antes ou use outro domínio."
    )
  })

  it("traduz conflito de subdomínio de tracking sem sugerir duplicidade local", () => {
    const result = mapResendDomainError(
      'A tracking domain with the subdomain "links" already exists for this domain.',
      "tracking",
      "onsidemarketing.com.br"
    )

    expect(result).toBe(
      "Este subdomínio de tracking já está em uso no Resend. Escolha outro subdomínio ou use o que já está vinculado a este domínio."
    )
    expect(result).not.toContain("domínio já está cadastrado")
  })

  it("traduz domínio inválido", () => {
    const result = mapResendDomainError("Invalid domain name provided", "connect")

    expect(result).toContain("domínio válido")
  })

  it("traduz rate limit", () => {
    const result = mapResendDomainError("Rate limit exceeded", "connect")

    expect(result).toContain("Muitas tentativas")
  })

  it("usa fallback por contexto quando mensagem é desconhecida", () => {
    expect(mapResendDomainError("Unexpected provider failure", "connect")).toContain(
      "conectar o domínio"
    )
    expect(mapResendDomainError("Unexpected provider failure", "disconnect")).toContain(
      "remover o domínio"
    )
    expect(mapResendDomainError("Unexpected provider failure", "verify")).toContain(
      "verificação"
    )
    expect(mapResendDomainError("Unexpected provider failure", "records")).toContain(
      "registros DNS"
    )
  })

  it("usa fallback quando mensagem está vazia", () => {
    expect(mapResendDomainError(undefined, "connect")).toContain("conectar o domínio")
    expect(mapResendDomainError("", "verify")).toContain("verificação")
  })
})
