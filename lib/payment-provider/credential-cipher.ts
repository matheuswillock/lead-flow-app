import crypto from "node:crypto"

const KEY_ID = "primary"
const CIPHER_VERSION = "v1"
const IV_BYTES = 12

export type EncryptedProviderCredential = {
  readonly keyId: string
  readonly valueCiphertext: string
}

export function encryptProviderCredential(value: string): EncryptedProviderCredential {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return {
    keyId: KEY_ID,
    valueCiphertext: [
      CIPHER_VERSION,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join("."),
  }
}

export function decryptProviderCredential(valueCiphertext: string, keyId: string): string {
  if (keyId !== KEY_ID) throw new Error("Identificador da chave de credenciais não suportado")
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = valueCiphertext.split(".")
  if (version !== CIPHER_VERSION || !encodedIv || !encodedTag || encodedCiphertext === undefined || extra) {
    throw new Error("Credencial de provider cifrada inválida")
  }

  const iv = decodeBase64Url(encodedIv)
  const tag = decodeBase64Url(encodedTag)
  const encrypted = decodeBase64Url(encodedCiphertext)
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error("Credencial de provider cifrada inválida")
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

function encryptionKey(): Buffer {
  const value = process.env.PAYMENT_PROVIDER_ENCRYPTION_KEY?.trim()
  if (!value) throw new Error("PAYMENT_PROVIDER_ENCRYPTION_KEY é obrigatória")
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("PAYMENT_PROVIDER_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais")
  }
  return Buffer.from(value, "hex")
}

function decodeBase64Url(value: string): Buffer {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Credencial de provider cifrada inválida")
  const decoded = Buffer.from(value, "base64url")
  if (decoded.toString("base64url") !== value) {
    throw new Error("Credencial de provider cifrada inválida")
  }
  return decoded
}
