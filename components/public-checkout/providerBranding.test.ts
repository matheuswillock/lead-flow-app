import { describe, expect, it } from "bun:test"
import { DEFAULT_CHECKOUT_PROVIDER, getProviderBranding, resolveProviderBranding } from "./providerBranding"

describe("getProviderBranding", () => {
  it("mantém o logo do Asaas para o provider ASAAS", () => {
    const branding = getProviderBranding("ASAAS")

    expect(branding.label).toBe("Asaas Pagamentos")
    expect(branding.logoUrl).toBe("/asaas-pagamentos-logo.svg")
    expect(branding.logoAlt).toBe("Asaas Pagamentos")
  })

  it("usa rótulo textual neutro e nenhum logo para o ABACATE_PAY", () => {
    const branding = getProviderBranding("ABACATE_PAY")

    expect(branding.label).toBe("Pagamento processado pela AbacatePay")
    expect(branding.logoUrl).toBeUndefined()
    expect(branding.logoAlt).toBeUndefined()
  })

  it("usa o Asaas como padrão dos fluxos legados", () => {
    expect(DEFAULT_CHECKOUT_PROVIDER).toBe("ASAAS")
    expect(getProviderBranding(undefined)).toEqual(getProviderBranding("ASAAS"))
  })
})

describe("resolveProviderBranding", () => {
  it("sem dado do banco devolve o catálogo estático", () => {
    expect(resolveProviderBranding("ASAAS", null)).toEqual(getProviderBranding("ASAAS"))
    expect(resolveProviderBranding("ABACATE_PAY", { displayName: "  ", logoUrl: null })).toEqual(
      getProviderBranding("ABACATE_PAY")
    )
  })

  it("dado do banco vence o catálogo e não mistura o logo estático", () => {
    const branding = resolveProviderBranding("ASAAS", { displayName: "Pagamentos XPTO" })

    expect(branding).toEqual({ label: "Pagamentos XPTO" })
  })

  it("usa logo e texto alternativo do banco, com o nome como alt de reserva", () => {
    expect(
      resolveProviderBranding("ABACATE_PAY", {
        displayName: "XPTO",
        logoUrl: "https://cdn.exemplo.com/xpto.svg",
        logoAltText: "Logo XPTO",
      })
    ).toEqual({ label: "XPTO", logoUrl: "https://cdn.exemplo.com/xpto.svg", logoAlt: "Logo XPTO" })
    expect(resolveProviderBranding("ABACATE_PAY", { displayName: "XPTO", logoUrl: "/xpto.svg" }).logoAlt).toBe("XPTO")
  })

  it("descarta logo com esquema inseguro", () => {
    expect(resolveProviderBranding("ABACATE_PAY", { displayName: "XPTO", logoUrl: "data:text/html,x" }).logoUrl).toBeUndefined()
    expect(resolveProviderBranding("ABACATE_PAY", { displayName: "XPTO", logoUrl: "http://x.com/a.png" }).logoUrl).toBeUndefined()
    expect(resolveProviderBranding("ABACATE_PAY", { displayName: "XPTO", logoUrl: "//evil.com/a.png" }).logoUrl).toBeUndefined()
  })
})
