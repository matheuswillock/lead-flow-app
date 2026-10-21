import { describe, expect, it } from "bun:test"
import {
  envFallbackNames,
  getAdapterDescriptor,
  isPaymentCapableProvider,
  isRequiredCredentialKey,
  isValidCredentialKey,
  listAdapterDescriptors,
} from "./credential-schema"

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

  it("Asaas exige API_KEY e WEBHOOK_TOKEN; WALLET_ID e BASE_URL são opcionais", () => {
    const fields = getAdapterDescriptor("ASAAS").fields
    expect(fields.filter((f) => f.required).map((f) => f.key)).toEqual(["API_KEY", "WEBHOOK_TOKEN"])
    expect(fields.filter((f) => !f.required).map((f) => f.key)).toEqual(["WALLET_ID", "BASE_URL"])
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
