import { describe, expect, it } from "bun:test"
import {
  buildCredentialRows,
  canMakeDefault,
  findCurrentDefault,
  getApplicableSettings,
  getDefaultBlockers,
  missingRequiredCredentials,
  replaceInstance,
} from "../features/utils/providerInstanceRules"
import { ADAPTERS, ALL_CREDENTIALS_SET, makeInstance } from "./testHarness"

describe("providerInstanceRules", () => {
  it("bloqueia padrão para instância somente de credenciais, como o servidor informa", () => {
    const credentialsOnly = makeInstance({
      paymentCapable: false,
      isDefault: false,
      defaultBlockers: ["Somente credenciais: o adapter não declara capacidades de pagamento."],
    })
    expect(canMakeDefault(credentialsOnly)).toBe(false)
    expect(getDefaultBlockers(credentialsOnly).join(" ")).toContain("Somente credenciais")
  })

  it("a instância que já é o padrão não lista bloqueios", () => {
    expect(getDefaultBlockers(makeInstance({ isDefault: true, defaultBlockers: ["x"] }))).toEqual([])
  })

  it("usa os bloqueios informados pelo servidor, sem recalculá-los", () => {
    const instance = makeInstance({ isDefault: false, defaultBlockers: ["Motivo do servidor"] })
    expect(getDefaultBlockers(instance)).toEqual(["Motivo do servidor"])
    expect(canMakeDefault(instance)).toBe(false)
    expect(canMakeDefault(makeInstance({ isDefault: false, defaultBlockers: [] }))).toBe(true)
  })

  it("ignora credenciais de política ao calcular o que falta e ao montar as linhas", () => {
    const instance = makeInstance({
      credentials: [
        ...ALL_CREDENTIALS_SET,
        { key: "REQUIRE_SIGNATURE", isSet: false, last4: null, fingerprint: null, required: true, updatedAt: null },
      ],
    })
    expect(missingRequiredCredentials(instance)).toEqual([])
    expect(buildCredentialRows(instance, ADAPTERS[0]).map((r) => r.key)).toEqual(["API_KEY", "WEBHOOK_SECRET"])
  })

  it("mostra configurações só quando aplicáveis", () => {
    expect(getApplicableSettings(makeInstance({ paymentCapable: false, applicableSettings: [] }))).toEqual([])
    expect(getApplicableSettings(makeInstance())).toEqual(["requireSignature", "cardEnabled"])
    expect(getApplicableSettings(makeInstance({ applicableSettings: ["cardEnabled"] }))).toEqual(["cardEnabled"])
  })

  it("permite padrão para instância com pagamento que ainda não é o padrão", () => {
    expect(canMakeDefault(makeInstance({ isDefault: false, credentials: ALL_CREDENTIALS_SET }))).toBe(true)
    expect(canMakeDefault(makeInstance({ isDefault: true }))).toBe(false)
  })

  it("lista credenciais obrigatórias pendentes", () => {
    expect(missingRequiredCredentials(makeInstance())).toEqual(["WEBHOOK_SECRET"])
  })

  it("cruza o schema do adapter e mantém chaves extras", () => {
    const instance = makeInstance({
      credentials: [
        ...makeInstance().credentials,
        { key: "EXTRA_KEY", isSet: true, last4: "9999", fingerprint: "fp", required: false, updatedAt: null },
      ],
    })
    const rows = buildCredentialRows(instance, ADAPTERS[0])
    expect(rows.map((r) => r.key)).toEqual(["API_KEY", "WEBHOOK_SECRET", "EXTRA_KEY"])
    expect(rows[0].label).toBe("Chave de API")
  })

  it("replaceInstance mantém um único padrão por ambiente", () => {
    const a = makeInstance({ id: "a", isDefault: true })
    const b = makeInstance({ id: "b", isDefault: false })
    const next = replaceInstance([a, b], { ...b, isDefault: true })
    expect(findCurrentDefault(next)?.id).toBe("b")
    expect(next.filter((i) => i.isDefault)).toHaveLength(1)
  })
})
