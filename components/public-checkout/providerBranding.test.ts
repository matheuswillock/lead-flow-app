import { describe, expect, it } from "bun:test"
import { DEFAULT_CHECKOUT_PROVIDER, getProviderBranding } from "./providerBranding"

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
