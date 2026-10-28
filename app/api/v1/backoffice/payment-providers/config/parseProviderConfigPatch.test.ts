import { describe, expect, it } from "bun:test"
import { parseProviderConfigPatch } from "./parseProviderConfigPatch"

describe("parseProviderConfigPatch", () => {
  it("aceita cardEnabled booleano junto da revisão esperada", () => {
    expect(parseProviderConfigPatch({ cardEnabled: true, expectedRevision: 2 })).toEqual({
      cardEnabled: true,
      expectedRevision: 2,
    })
    expect(parseProviderConfigPatch({ cardEnabled: false, expectedRevision: 2 })).toEqual({
      cardEnabled: false,
      expectedRevision: 2,
    })
  })

  it("não inclui cardEnabled quando o campo não é enviado", () => {
    expect(parseProviderConfigPatch({ enabled: true, expectedRevision: 2 })).toEqual({
      enabled: true,
      expectedRevision: 2,
    })
  })

  it.each(["true", 1, null, {}])("rejeita cardEnabled que não é booleano (%p)", (cardEnabled) => {
    expect(parseProviderConfigPatch({ cardEnabled, expectedRevision: 2 })).toBeNull()
  })

  it("rejeita patch sem revisão inteira", () => {
    expect(parseProviderConfigPatch({ cardEnabled: true })).toBeNull()
    expect(parseProviderConfigPatch({ cardEnabled: true, expectedRevision: 1.5 })).toBeNull()
    expect(parseProviderConfigPatch(null)).toBeNull()
  })

  it("mantém as validações dos demais campos", () => {
    expect(parseProviderConfigPatch({ killSwitch: "yes", expectedRevision: 1 })).toBeNull()
    expect(parseProviderConfigPatch({ rolloutState: "OTHER", expectedRevision: 1 })).toBeNull()
  })
})
