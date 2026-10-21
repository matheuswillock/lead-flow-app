import { describe, expect, it } from "bun:test"
import {
  assertInstanceRoutingPolicy,
  parseStoredSettings,
  toInstanceView,
  validateDisplayName,
  validateLogoAltText,
  validateLogoUrl,
  validateSettingsPatch,
  type ProviderInstanceRecord,
} from "./instance"

const record: ProviderInstanceRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  provider: "ABACATE_PAY",
  environment: "PRODUCTION",
  enabled: true,
  isDefault: true,
  externalAccountContext: "abacate-production",
  rolloutState: "ACTIVE",
  killSwitch: false,
  revision: 4,
  healthStatus: "HEALTHY",
  displayName: "Abacate Pay",
  logoUrl: null,
  logoAltText: null,
  settings: {},
  lastHealthCheckAt: new Date("2026-10-21T10:00:00.000Z"),
  lastErrorCode: null,
}

describe("validateLogoUrl", () => {
  it("aceita https público e normaliza", () => {
    expect(validateLogoUrl("https://cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png")
    expect(validateLogoUrl(null)).toBeNull()
    expect(validateLogoUrl("")).toBeNull()
  })

  it("rejeita javascript:, data:, http, localhost e credenciais embutidas", () => {
    for (const bad of [
      "javascript:void(0)",
      "data:image/png;base64,AAAA",
      "http://cdn.example.com/a.png",
      "https://localhost/a.png",
      "https://user:pass@cdn.example.com/a.png",
      "https://intranet/a.png",
      "nao-e-url",
      42,
    ]) {
      expect(() => validateLogoUrl(bad)).toThrow()
    }
  })
})

describe("validações de texto e settings", () => {
  it("valida nome e alt text", () => {
    expect(validateDisplayName("  Abacate  ")).toBe("Abacate")
    expect(() => validateDisplayName("   ")).toThrow()
    expect(() => validateDisplayName("x".repeat(81))).toThrow()
    expect(validateLogoAltText(undefined)).toBeNull()
    expect(() => validateLogoAltText("x".repeat(201))).toThrow()
  })

  it("settings rejeita chaves desconhecidas e tipos errados", () => {
    expect(validateSettingsPatch({ cardEnabled: false })).toEqual({ cardEnabled: false })
    expect(() => validateSettingsPatch({ other: true })).toThrow()
    expect(() => validateSettingsPatch({ requireSignature: "true" })).toThrow()
    expect(() => validateSettingsPatch([])).toThrow()
  })

  it("parseStoredSettings ignora lixo do banco", () => {
    expect(parseStoredSettings({ requireSignature: true, cardEnabled: "x", z: 1 })).toEqual({
      requireSignature: true,
    })
    expect(parseStoredSettings(null)).toEqual({})
  })
})

describe("assertInstanceRoutingPolicy (PAY-CRED-T019)", () => {
  it("instância só de credencial (ASAAS) não pode ser padrão nem passar de SANDBOX_VALIDATED", () => {
    const base = { provider: "ASAAS" as const, enabled: false, isDefault: false, rolloutState: "DISABLED" as const }
    expect(() => assertInstanceRoutingPolicy(base)).not.toThrow()
    expect(() => assertInstanceRoutingPolicy({ ...base, rolloutState: "SANDBOX_VALIDATED" })).not.toThrow()
    expect(() => assertInstanceRoutingPolicy({ ...base, isDefault: true })).toThrow()
    expect(() => assertInstanceRoutingPolicy({ ...base, rolloutState: "APPROVED" })).toThrow()
    expect(() => assertInstanceRoutingPolicy({ ...base, rolloutState: "ACTIVE" })).toThrow()
  })

  it("adapter com capacidade de pagamento não é restringido", () => {
    expect(() =>
      assertInstanceRoutingPolicy({ provider: "ABACATE_PAY", enabled: true, isDefault: true, rolloutState: "ACTIVE" }),
    ).not.toThrow()
  })
})

describe("toInstanceView", () => {
  it("nunca contém valor de credencial e lista todas as chaves do schema", () => {
    const view = toInstanceView(
      record,
      [
        { key: "API_KEY", last4: "abcd", fingerprint: "0123456789ab", updatedAt: new Date("2026-10-21T09:00:00.000Z") },
        { key: "EXTRA_TOKEN", last4: null, fingerprint: "ffffffffffff", updatedAt: new Date("2026-10-21T09:00:00.000Z") },
      ],
      true,
    )
    expect(view.credentials.map((c) => c.key)).toEqual([
      "API_KEY",
      "WEBHOOK_SECRET",
      "PUBLIC_KEY",
      "WEBHOOK_SECRET_PREVIOUS",
      "REQUIRE_SIGNATURE",
      "EXTRA_TOKEN",
    ])
    expect(view.credentials[0]).toEqual({
      key: "API_KEY",
      isSet: true,
      last4: "abcd",
      fingerprint: "0123456789ab",
      required: true,
      updatedAt: "2026-10-21T09:00:00.000Z",
    })
    expect(view.credentials[1]).toMatchObject({ isSet: false, last4: null, required: true })
    expect(view.paymentCapable).toBe(true)
    expect(view.settings).toEqual({ requireSignature: false, cardEnabled: true })
    expect(view.configRevision).toBe(4)
    expect(Object.keys(view.credentials[0]).sort()).toEqual(
      ["fingerprint", "isSet", "key", "last4", "required", "updatedAt"],
    )
  })

  it("cardEnabled armazenado vence a reserva", () => {
    const view = toInstanceView({ ...record, settings: { cardEnabled: false } }, [], true)
    expect(view.settings.cardEnabled).toBe(false)
  })
})
