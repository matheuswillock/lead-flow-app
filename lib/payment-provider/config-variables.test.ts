import { afterEach, describe, expect, it } from "bun:test"
import {
  applyProviderConfigVariables,
  resolveProviderConfigVariables,
  summarizeStoredProviderConfigVariables,
} from "./config-variables"

const originalKey = process.env.ENCRYPTION_KEY
const key = "a".repeat(64)

afterEach(() => {
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY
  else process.env.ENCRYPTION_KEY = originalKey
})

describe("provider config variables", () => {
  it("cifra segredo em repouso, mascara a listagem e decifra só para runtime", () => {
    process.env.ENCRYPTION_KEY = key
    const stored = applyProviderConfigVariables([], [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-api-value" },
      { name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC", value: "pk_public_test" },
    ])

    expect(JSON.stringify(stored)).not.toContain("secret-api-value")
    expect(stored[0]?.value).toMatch(/^v1\./)
    expect(summarizeStoredProviderConfigVariables(stored)).toEqual([
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", configured: true },
      { name: "ABACATE_PAY_DEV_PUBLIC_KEY", visibility: "PUBLIC", configured: true, value: "pk_public_test" },
    ])
    expect(resolveProviderConfigVariables(stored)).toEqual({
      ABACATE_PAY_DEV_API_KEY: "secret-api-value",
      ABACATE_PAY_DEV_PUBLIC_KEY: "pk_public_test",
    })
  })

  it("preserva segredo omitido e remove variáveis excluídas do patch", () => {
    process.env.ENCRYPTION_KEY = key
    const existing = applyProviderConfigVariables([], [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-api-value" },
      { name: "ABACATE_PAY_DEV_WEBHOOK_SECRET", visibility: "SECRET", value: "old-webhook-secret" },
    ])
    const updated = applyProviderConfigVariables(existing, [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET" },
    ])
    expect(resolveProviderConfigVariables(updated)).toEqual({
      ABACATE_PAY_DEV_API_KEY: "secret-api-value",
    })
  })

  it("substitui valor de segredo ao editar e nunca o retorna pela leitura pública", () => {
    process.env.ENCRYPTION_KEY = key
    const original = applyProviderConfigVariables([], [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "old-secret" },
    ])
    const updated = applyProviderConfigVariables(original, [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "new-secret" },
    ])
    expect(resolveProviderConfigVariables(updated).ABACATE_PAY_DEV_API_KEY).toBe("new-secret")
    expect(summarizeStoredProviderConfigVariables(updated)[0]).toEqual({
      name: "ABACATE_PAY_DEV_API_KEY",
      visibility: "SECRET",
      configured: true,
    })
  })

  it("falha fechado quando não existe chave de cifra ou o conteúdo foi adulterado", () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => applyProviderConfigVariables([], [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-api-value" },
    ])).toThrow("ENCRYPTION_KEY")

    process.env.ENCRYPTION_KEY = key
    const [stored] = applyProviderConfigVariables([], [
      { name: "ABACATE_PAY_DEV_API_KEY", visibility: "SECRET", value: "secret-api-value" },
    ])
    expect(() => resolveProviderConfigVariables([{ ...stored!, value: `${stored!.value}tampered` }])).toThrow()
    expect(() => resolveProviderConfigVariables([{ ...stored!, name: "ABACATE_PAY_PRODUCTION_API_KEY" }])).toThrow()
  })
})
