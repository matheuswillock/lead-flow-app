import { describe, expect, it } from "bun:test"
import {
  buildCredentialRows,
  canMakeDefault,
  findCurrentDefault,
  makeDefaultBlockedReason,
  missingRequiredCredentials,
  replaceInstance,
} from "../features/utils/providerInstanceRules"
import { ADAPTERS, makeInstance } from "./testHarness"

describe("providerInstanceRules", () => {
  it("bloqueia padrão para instância somente de credenciais", () => {
    const credentialsOnly = makeInstance({ paymentCapable: false, isDefault: false })
    expect(canMakeDefault(credentialsOnly)).toBe(false)
    expect(makeDefaultBlockedReason(credentialsOnly)).toContain("Somente credenciais")
  })

  it("permite padrão para instância com pagamento que ainda não é o padrão", () => {
    expect(canMakeDefault(makeInstance({ isDefault: false }))).toBe(true)
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
