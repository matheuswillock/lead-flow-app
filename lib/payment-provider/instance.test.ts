import { describe, expect, it } from "bun:test"
import {
  assertCanBeDefault,
  assertInstanceRoutingPolicy,
  assertSettingsApplicable,
  computeDefaultBlockers,
  parseStoredSettings,
  pickPrimaryInstance,
  ProviderInstanceConflictError,
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
    // Promover uma instância só de credencial é um estado incompatível: 409, como as demais recusas de padrão.
    expect(() => assertInstanceRoutingPolicy({ ...base, isDefault: true })).toThrow(ProviderInstanceConflictError)
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

describe("pickPrimaryInstance", () => {
  const instance = (id: string, overrides: Partial<ProviderInstanceRecord> = {}) => ({
    ...record,
    id,
    isDefault: false,
    externalAccountContext: `ctx-${id}`,
    ...overrides,
  })

  it("prefere a padrão elegível", () => {
    const a = instance("a")
    const b = instance("b", { isDefault: true })
    expect(pickPrimaryInstance([a, b], "ABACATE_PAY")?.id).toBe("b")
  })

  it("ignora padrão inelegível (kill switch, rollout, saúde, contexto) se houver elegível", () => {
    const eligible = instance("a")
    for (const broken of [
      { killSwitch: true },
      { rolloutState: "APPROVED" as const },
      { healthStatus: "UNKNOWN" as const },
      { externalAccountContext: " " },
      { enabled: false },
    ]) {
      const defaultBroken = instance("b", { isDefault: true, ...broken })
      expect(pickPrimaryInstance([defaultBroken, eligible], "ABACATE_PAY")?.id).toBe("a")
    }
  })

  it("sem nenhuma elegível, mantém a reserva: padrão, habilitada, primeira", () => {
    const first = instance("a", { enabled: false, rolloutState: "DISABLED" })
    const enabled = instance("b", { healthStatus: "UNKNOWN" })
    const def = instance("c", { isDefault: true, enabled: false, rolloutState: "DISABLED" })
    expect(pickPrimaryInstance([first, enabled], "ABACATE_PAY")?.id).toBe("b")
    expect(pickPrimaryInstance([first, enabled, def], "ABACATE_PAY")?.id).toBe("c")
    expect(pickPrimaryInstance([first], "ABACATE_PAY")?.id).toBe("a")
  })

  it("filtra pelo provider", () => {
    expect(pickPrimaryInstance([instance("a", { provider: "ASAAS" })], "ABACATE_PAY")).toBeUndefined()
  })
})

describe("computeDefaultBlockers / assertCanBeDefault", () => {
  const eligible = { provider: "ABACATE_PAY" as const, enabled: true, killSwitch: false, rolloutState: "ACTIVE" as const }
  const both = [{ key: "API_KEY" }, { key: "WEBHOOK_SECRET" }]

  it("vazio quando enabled, sem kill switch, ACTIVE, capaz de pagamento e com obrigatórias", () => {
    expect(computeDefaultBlockers(eligible, both)).toEqual([])
    expect(() => assertCanBeDefault([])).not.toThrow()
  })

  it("lista cada motivo em PT-BR", () => {
    const blockers = computeDefaultBlockers(
      { provider: "ABACATE_PAY", enabled: false, killSwitch: true, rolloutState: "APPROVED" },
      [],
    )
    expect(blockers).toEqual([
      "A instância está desativada.",
      "O kill switch está ligado.",
      "O rollout precisa estar ACTIVE (atual: APPROVED).",
      "Falta a credencial obrigatória Chave de API (API_KEY).",
      "Falta a credencial obrigatória Segredo do webhook (WEBHOOK_SECRET).",
    ])
    expect(() => assertCanBeDefault(blockers)).toThrow("Esta instância ainda não pode ser o provider padrão")
  })

  it("credencial coberta pela reserva de ambiente não bloqueia", () => {
    expect(computeDefaultBlockers(eligible, [{ key: "API_KEY" }], new Set(["WEBHOOK_SECRET"]))).toEqual([])
  })

  it("adapter sem capacidade de pagamento sempre bloqueia", () => {
    const blockers = computeDefaultBlockers({ ...eligible, provider: "ASAAS" }, [{ key: "API_KEY" }, { key: "WEBHOOK_TOKEN" }])
    expect(blockers).toEqual(["O adapter Asaas não tem capacidade de pagamento (instância somente de credencial)."])
  })
})

describe("assertSettingsApplicable", () => {
  it("Abacate aceita ambos; Asaas rejeita qualquer setting", () => {
    expect(() => assertSettingsApplicable("ABACATE_PAY", { requireSignature: true, cardEnabled: false })).not.toThrow()
    expect(() => assertSettingsApplicable("ASAAS", {})).not.toThrow()
    expect(() => assertSettingsApplicable("ASAAS", { cardEnabled: true })).toThrow("não se aplica")
  })
})
