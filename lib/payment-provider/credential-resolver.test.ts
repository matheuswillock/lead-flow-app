import { afterEach, describe, expect, it } from "bun:test"
import { encryptProviderCredential } from "./credential-cipher"
import { resolveOptionalProviderCredential, resolveProviderCredential } from "./credential-resolver"

const originalKey = process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
const testKey = "2a".repeat(32)

afterEach(() => {
  if (originalKey === undefined) delete process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
  else process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = originalKey
})

describe("resolveProviderCredential", () => {
  it("uses a saved credential instead of the environment value", async () => {
    process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = testKey
    const encrypted = encryptProviderCredential("database-secret")
    const result = await resolveProviderCredential({
      stored: async () => encrypted,
      fromEnvironment: () => "legacy-environment-secret",
    })

    expect(result).toEqual({ value: "database-secret", source: "database" })
  })

  it("falls back to the environment only when no value has been saved", async () => {
    const result = await resolveProviderCredential({
      stored: async () => null,
      fromEnvironment: () => "legacy-environment-secret",
    })

    expect(result).toEqual({ value: "legacy-environment-secret", source: "environment" })
  })

  it("does not hide stored credential decryption errors with an environment fallback", async () => {
    const result = resolveProviderCredential({
      stored: async () => ({ keyId: "primary", valueCiphertext: "tampered" }),
      fromEnvironment: () => "legacy-environment-secret",
    })

    await expect(result).rejects.toThrow()
  })

  it("rejects missing credentials", async () => {
    await expect(
      resolveProviderCredential({ stored: async () => null, fromEnvironment: () => undefined }),
    ).rejects.toThrow("Credencial obrigatória do provider não configurada")
  })
})

describe("resolveOptionalProviderCredential", () => {
  it("returns missing when neither database nor environment has the optional value", async () => {
    await expect(resolveOptionalProviderCredential({
      stored: async () => null,
      fromEnvironment: () => undefined,
    })).resolves.toEqual({ value: null, source: "missing" })
  })

  it("does not hide a saved optional credential decryption error", async () => {
    await expect(resolveOptionalProviderCredential({
      stored: async () => ({ keyId: "primary", valueCiphertext: "tampered" }),
      fromEnvironment: () => "environment-public-key",
    })).rejects.toThrow()
  })
})
