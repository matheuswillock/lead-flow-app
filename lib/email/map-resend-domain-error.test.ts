import { describe, expect, it } from "bun:test"
import {
  isSelfInflictedTrackingConflict,
  isTrackingSubdomainConflict,
  mapResendDomainError,
} from "./map-resend-domain-error"

const RESEND_409_SAME_SUBDOMAIN = {
  name: "validation_error",
  message: 'A tracking domain with the subdomain "links" already exists for this domain.',
  statusCode: 409,
}

const RESEND_409_OTHER_SUBDOMAIN = {
  name: "validation_error",
  message: 'A tracking domain with the subdomain "email" already exists for this domain.',
  statusCode: 409,
}

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

  /**
   * O conflito que sobra aqui é o que NÃO é do próprio fluxo — o nosso vira
   * sucesso idempotente antes de chegar em mensagem. Mandar "escolha outro
   * subdomínio" era orientação impossível: o subdomínio é fixo do produto e o
   * operador não tem esse controle na tela.
   */
  it("orienta suporte no conflito de subdomínio de tracking, não escolha de subdomínio", () => {
    const result = mapResendDomainError(
      'A tracking domain with the subdomain "links" already exists for this domain.',
      "tracking",
      "onsidemarketing.com.br"
    )

    expect(result).toContain("onsidemarketing.com.br")
    expect(result).toContain("suporte do Corretor Studio")
    expect(result).not.toContain("Escolha outro subdomínio")
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

describe("isSelfInflictedTrackingConflict", () => {
  it("reconhece o 409 causado pelo trackingSubdomain que nós mesmos pedimos", () => {
    expect(isSelfInflictedTrackingConflict(RESEND_409_SAME_SUBDOMAIN, "links")).toBe(true)
  })

  it("não reconhece conflito de subdomínio divergente", () => {
    expect(isSelfInflictedTrackingConflict(RESEND_409_OTHER_SUBDOMAIN, "links")).toBe(false)
  })

  it("não reconhece 409 de outra natureza", () => {
    expect(
      isSelfInflictedTrackingConflict(
        { message: "Domain already exists", statusCode: 409 },
        "links"
      )
    ).toBe(false)
  })

  it("não reconhece ausência de erro nem falha real", () => {
    expect(isSelfInflictedTrackingConflict(null, "links")).toBe(false)
    expect(
      isSelfInflictedTrackingConflict({ message: "Internal server error", statusCode: 500 }, "links")
    ).toBe(false)
  })
})

describe("isTrackingSubdomainConflict", () => {
  it("aceita 409 e mensagem de subdomínio já existente", () => {
    expect(isTrackingSubdomainConflict(RESEND_409_SAME_SUBDOMAIN)).toBe(true)
    expect(
      isTrackingSubdomainConflict({
        message: 'A tracking domain with the subdomain "links" already exists for this domain.',
        statusCode: 422,
      })
    ).toBe(true)
  })

  it("recusa erro sem conflito", () => {
    expect(isTrackingSubdomainConflict(null)).toBe(false)
    expect(isTrackingSubdomainConflict({ message: "Internal server error", statusCode: 500 })).toBe(
      false
    )
  })
})
