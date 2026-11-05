import { afterEach, describe, expect, it } from "bun:test"
import {
  decryptProviderCredential,
  encryptProviderCredential,
} from "./credential-cipher"

const originalKey = process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
const testKey = "1f".repeat(32)

afterEach(() => {
  if (originalKey === undefined) delete process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
  else process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = originalKey
})

describe("payment provider credential cipher", () => {
  it("encrypts and decrypts credentials without storing plaintext", () => {
    process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = testKey

    const encrypted = encryptProviderCredential("provider-secret-1234")

    expect(encrypted.keyId).toBe("primary")
    expect(encrypted.valueCiphertext).not.toContain("provider-secret-1234")
    expect(decryptProviderCredential(encrypted.valueCiphertext, encrypted.keyId)).toBe(
      "provider-secret-1234",
    )
  })

  it("uses a fresh nonce for each encryption", () => {
    process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = testKey

    const first = encryptProviderCredential("same-secret")
    const second = encryptProviderCredential("same-secret")

    expect(second.valueCiphertext).not.toBe(first.valueCiphertext)
  })

  it("fails closed when the key is missing or ciphertext is tampered", () => {
    delete process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY
    expect(() => encryptProviderCredential("secret")).toThrow(
      "PAYMENT_PROVIDER_ENCRYPTION_KEY é obrigatória",
    )

    process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY = testKey
    const encrypted = encryptProviderCredential("secret")
    expect(() => decryptProviderCredential(`${encrypted.valueCiphertext}x`, encrypted.keyId)).toThrow()
  })
})
