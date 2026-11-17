import { describe, expect, it } from "bun:test"
import { parseProviderConfigPatch } from "./parseProviderConfigPatch"

const parse = (value: unknown) => parseProviderConfigPatch(value, "ABACATE_PAY", "DEV")

describe("parseProviderConfigPatch", () => {
  it("aceita cardEnabled booleano junto da revisão esperada", () => {
    expect(parse({ cardEnabled: true, expectedRevision: 2 })).toEqual({
      cardEnabled: true,
      expectedRevision: 2,
    })
    expect(parse({ cardEnabled: false, expectedRevision: 2 })).toEqual({
      cardEnabled: false,
      expectedRevision: 2,
    })
  })

  it("não inclui cardEnabled quando o campo não é enviado", () => {
    expect(parse({ enabled: true, expectedRevision: 2 })).toEqual({
      enabled: true,
      expectedRevision: 2,
    })
  })

  it.each(["true", 1, null, {}])("rejeita cardEnabled que não é booleano (%p)", (cardEnabled) => {
    expect(parse({ cardEnabled, expectedRevision: 2 })).toBeNull()
  })

  it("rejeita patch sem revisão inteira", () => {
    expect(parse({ cardEnabled: true })).toBeNull()
    expect(parse({ cardEnabled: true, expectedRevision: 1.5 })).toBeNull()
    expect(parse(null)).toBeNull()
  })

  it("mantém as validações dos demais campos", () => {
    expect(parse({ killSwitch: "yes", expectedRevision: 1 })).toBeNull()
    expect(parse({ rolloutState: "OTHER", expectedRevision: 1 })).toBeNull()
  })

  it("persiste somente uma chave pública Abacate com o prefixo esperado", () => {
    expect(parse({ publicKey: "pk_EC6RfXL3MPQDaCk0RRuGn2Hx", expectedRevision: 4 }))
      .toEqual({ publicKey: "pk_EC6RfXL3MPQDaCk0RRuGn2Hx", expectedRevision: 4 })
    expect(parse({ publicKey: "secret_api_key_value", expectedRevision: 4 })).toBeNull()
  })

  it("aceita variáveis do provider/ambiente com valor secreto omitido para preservar", () => {
    expect(parse({
      variables: [
        { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-value" },
        { name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC", value: "pk_public_test" },
      ],
      expectedRevision: 4,
    })).toEqual({
      variables: [
        { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-value" },
        { name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC", value: "pk_public_test" },
      ],
      expectedRevision: 4,
    })
    expect(parseProviderConfigPatch({
      variables: [{ name: "ABACATE_PAY_PRODUCTION_API_KEY", visibility: "SECRET" }],
      expectedRevision: 4,
    }, "ABACATE_PAY", "DEV")).toBeNull()
    expect(parse({ variables: [{ name: "ASAAS_DEV_API_KEY", visibility: "SECRET" }], expectedRevision: 4 })).toBeNull()
    expect(parse({ variables: [{ name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET" }, { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET" }], expectedRevision: 4 })).toBeNull()
    expect(parse({ variables: [{ name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC" }], expectedRevision: 4 })).toBeNull()
  })
})
