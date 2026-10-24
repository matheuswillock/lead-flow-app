import { describe, expect, it } from "bun:test"
import {
  envFallbackNames,
  getAdapterDescriptor,
  isPaymentCapableProvider,
  isPolicyCredentialKey,
  isRequiredCredentialKey,
  isValidCredentialKey,
  listAdapterDescriptors,
} from "./credential-schema"

describe("chaves de política", () => {
  it("REQUIRE_SIGNATURE e CARD_PAYMENTS_ENABLED são política; credenciais comuns não são", () => {
    expect(isPolicyCredentialKey("REQUIRE_SIGNATURE")).toBe(true)
    expect(isPolicyCredentialKey("CARD_PAYMENTS_ENABLED")).toBe(true)
    expect(isPolicyCredentialKey("API_KEY")).toBe(false)
    expect(isPolicyCredentialKey("EXTRA_TOKEN_2")).toBe(false)
  })
})

describe("credential schema", () => {
  it("Abacate exige API_KEY e WEBHOOK_SECRET e deixa o resto opcional", () => {
    const required = getAdapterDescriptor("ABACATE_PAY")
      .fields.filter((field) => field.required)
      .map((field) => field.key)
    expect(required).toEqual(["API_KEY", "WEBHOOK_SECRET"])
    const optional = getAdapterDescriptor("ABACATE_PAY")
      .fields.filter((field) => !field.required)
      .map((field) => field.key)
    expect(optional).toEqual(["PUBLIC_KEY", "WEBHOOK_SECRET_PREVIOUS", "REQUIRE_SIGNATURE"])
  })

  it("Asaas exige API_KEY e WEBHOOK_TOKEN; WALLET_ID é opcional", () => {
    const fields = getAdapterDescriptor("ASAAS").fields
    expect(fields.filter((f) => f.required).map((f) => f.key)).toEqual(["API_KEY", "WEBHOOK_TOKEN"])
    expect(fields.filter((f) => !f.required).map((f) => f.key)).toEqual(["WALLET_ID"])
  })

  it("somente o Abacate é capaz de pagamento no router", () => {
    expect(isPaymentCapableProvider("ABACATE_PAY")).toBe(true)
    expect(isPaymentCapableProvider("ASAAS")).toBe(false)
    expect(listAdapterDescriptors().map((a) => a.providerKey)).toEqual(["ABACATE_PAY", "ASAAS"])
  })

  it("aceita chaves extras arbitrárias e rejeita formatos inválidos", () => {
    expect(isValidCredentialKey("EXTRA_TOKEN_2")).toBe(true)
    for (const bad of ["a", "lower", "1ABC", "A", "WITH SPACE", "X".repeat(65), "", null, 5]) {
      expect(isValidCredentialKey(bad)).toBe(false)
    }
    expect(isRequiredCredentialKey("ABACATE_PAY", "EXTRA_TOKEN")).toBe(false)
  })

  it("BASE_URL e demais chaves de destino de rede NÃO são aceitas (SSRF)", () => {
    for (const key of ["BASE_URL", "ASAAS_URL", "API_HOST", "WEBHOOK_ENDPOINT", "CALLBACK_URI", "URL"]) {
      expect(isValidCredentialKey(key)).toBe(false)
    }
    expect(getAdapterDescriptor("ASAAS").fields.some((f) => f.key === "BASE_URL")).toBe(false)
    expect(isValidCredentialKey("URL_TOKEN")).toBe(true)
  })

  it("mapeia a reserva de ambiente por instância", () => {
    expect(
      envFallbackNames("ABACATE_PAY", "API_KEY", {
        environment: "PRODUCTION",
        externalAccountContext: "abacate-production",
      }),
    ).toEqual(["ABACATE_PAY_PRODUCTION_API_KEY", "ABACATE_PAY_API_KEY"])
    expect(
      envFallbackNames("ASAAS", "API_KEY", { environment: "PRODUCTION", externalAccountContext: "primary" }),
    ).toEqual(["ASAAS_API_KEY"])
    expect(
      envFallbackNames("ASAAS", "API_KEY", { environment: "PRODUCTION", externalAccountContext: "legacy" }),
    ).toEqual(["ASAAS_LEGACY_API_KEY"])
    expect(
      envFallbackNames("ASAAS", "WALLET_ID", { environment: "PRODUCTION", externalAccountContext: "legacy" }),
    ).toEqual([])
    expect(
      envFallbackNames("ABACATE_PAY", "EXTRA_KEY", { environment: "DEV", externalAccountContext: "x" }),
    ).toEqual([])
  })
})
