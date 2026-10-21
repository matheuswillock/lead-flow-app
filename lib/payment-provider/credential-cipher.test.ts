import { describe, expect, it } from "bun:test"
import {
  CredentialCipherError,
  createCredentialCipher,
  createCredentialCipherFromEnv,
  describeCredentialValue,
} from "./credential-cipher"

const KEY_A = "a".repeat(64)
const KEY_B = "b".repeat(64)
const SECRET = "sk_live_super_secret_value_1234"

describe("credential cipher", () => {
  it("cifra no formato v1.<keyId>.<iv>.<tag>.<ciphertext> sem expor o valor", () => {
    const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const encrypted = cipher.encrypt(SECRET)
    const parts = encrypted.split(".")
    expect(parts).toHaveLength(5)
    expect(parts[0]).toBe("v1")
    expect(parts[1]).toBe("k1")
    expect(encrypted).not.toContain(SECRET)
    expect(cipher.keyId).toBe("k1")
    expect(cipher.decrypt(encrypted)).toBe(SECRET)
  })

  it("usa IV aleatório: dois encrypts do mesmo valor diferem", () => {
    const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    expect(cipher.encrypt(SECRET)).not.toBe(cipher.encrypt(SECRET))
  })

  it("decrypt com chave errada LANÇA em vez de devolver vazio", () => {
    const writer = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const reader = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_B } })
    expect(() => reader.decrypt(writer.encrypt(SECRET))).toThrow(CredentialCipherError)
  })

  it("decrypt de payload adulterado ou malformado lança", () => {
    const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const parts = cipher.encrypt(SECRET).split(".")
    parts[4] = Buffer.from("tampered").toString("base64url")
    expect(() => cipher.decrypt(parts.join("."))).toThrow(CredentialCipherError)
    expect(() => cipher.decrypt("lixo")).toThrow(CredentialCipherError)
    expect(() => cipher.decrypt("")).toThrow(CredentialCipherError)
  })

  it("a mensagem de erro nunca contém o valor", () => {
    const writer = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const reader = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_B } })
    try {
      reader.decrypt(writer.encrypt(SECRET))
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(SECRET)
    }
  })

  it("rotação: valor cifrado com a chave antiga continua legível e novo valor usa a chave nova", () => {
    const old = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const rotated = createCredentialCipher({ currentKeyId: "k2", keys: { k1: KEY_A, k2: KEY_B } })
    expect(rotated.decrypt(old.encrypt(SECRET))).toBe(SECRET)
    expect(rotated.encrypt(SECRET).split(".")[1]).toBe("k2")
  })

  it("keyId desconhecido lança", () => {
    const old = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const other = createCredentialCipher({ currentKeyId: "k2", keys: { k2: KEY_B } })
    expect(() => other.decrypt(old.encrypt(SECRET))).toThrow(CredentialCipherError)
  })

  it("o contexto (AAD) amarra o ciphertext à linha: trocar de credencial falha", () => {
    const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    const encrypted = cipher.encrypt(SECRET, "cfg-1:API_KEY")
    expect(cipher.decrypt(encrypted, "cfg-1:API_KEY")).toBe(SECRET)
    expect(() => cipher.decrypt(encrypted, "cfg-2:API_KEY")).toThrow(CredentialCipherError)
  })

  it("rejeita chave-mestra que não tenha 64 hex", () => {
    expect(() => createCredentialCipher({ currentKeyId: "k1", keys: { k1: "curta" } })).toThrow(
      CredentialCipherError,
    )
  })

  it("rejeita valor vazio", () => {
    const cipher = createCredentialCipher({ currentKeyId: "k1", keys: { k1: KEY_A } })
    expect(() => cipher.encrypt("")).toThrow(CredentialCipherError)
  })

  it("createCredentialCipherFromEnv lança sem PAYMENT_CREDENTIALS_ENCRYPTION_KEY", () => {
    expect(() => createCredentialCipherFromEnv({})).toThrow(CredentialCipherError)
    const cipher = createCredentialCipherFromEnv({ PAYMENT_CREDENTIALS_ENCRYPTION_KEY: KEY_A })
    expect(cipher.keyId).toBe("k1")
  })

  it("createCredentialCipherFromEnv aceita chave anterior para rotação", () => {
    const old = createCredentialCipherFromEnv({ PAYMENT_CREDENTIALS_ENCRYPTION_KEY: KEY_A })
    const next = createCredentialCipherFromEnv({
      PAYMENT_CREDENTIALS_ENCRYPTION_KEY: KEY_B,
      PAYMENT_CREDENTIALS_ENCRYPTION_KEY_ID: "k2",
      PAYMENT_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS: KEY_A,
      PAYMENT_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS_ID: "k1",
    })
    expect(next.decrypt(old.encrypt(SECRET))).toBe(SECRET)
  })
})

describe("describeCredentialValue", () => {
  it("devolve last4 e fingerprint que não revelam prefixo do valor", () => {
    const described = describeCredentialValue(SECRET)
    expect(described.last4).toBe("1234")
    expect(described.fingerprint).toMatch(/^[0-9a-f]{12}$/)
    expect(SECRET).not.toContain(described.fingerprint)
    expect(described.fingerprint).toBe(describeCredentialValue(SECRET).fingerprint)
  })

  it("não expõe last4 de valores curtos", () => {
    expect(describeCredentialValue("true").last4).toBeNull()
  })
})
