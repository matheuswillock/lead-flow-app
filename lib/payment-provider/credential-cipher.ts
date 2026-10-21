import crypto from "node:crypto"

/**
 * Cifra AES-256-GCM das credenciais de provider. Formato `v1.<keyId>.<iv>.<tag>.<ciphertext>`
 * (base64url). Diferente de `lib/studio-bot/host-cipher.ts`, falhas LANÇAM: uma credencial ilegível
 * jamais pode virar string vazia. Não depende de `lib/crypto.ts`.
 */

const VERSION = "v1"
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i
const MIN_LAST4_LENGTH = 12

export class CredentialCipherError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CredentialCipherError"
  }
}

export type CredentialCipherOptions = {
  readonly currentKeyId: string
  /** keyId -> 64 caracteres hex. Inclui as chaves antigas ainda necessárias para decifrar. */
  readonly keys: Readonly<Record<string, string>>
}

export interface CredentialCipher {
  readonly keyId: string
  encrypt(plaintext: string, context?: string): string
  decrypt(payload: string, context?: string): string
}

export function createCredentialCipher(options: CredentialCipherOptions): CredentialCipher {
  const keyring = buildKeyring(options.keys)
  if (!keyring.has(options.currentKeyId)) {
    throw new CredentialCipherError("Chave de cifra corrente não encontrada no chaveiro")
  }
  const currentKeyId = options.currentKeyId

  return {
    keyId: currentKeyId,
    encrypt(plaintext, context) {
      if (typeof plaintext !== "string" || plaintext === "") {
        throw new CredentialCipherError("Valor de credencial vazio")
      }
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv("aes-256-gcm", keyring.get(currentKeyId) as Buffer, iv)
      if (context) cipher.setAAD(Buffer.from(context, "utf8"))
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
      return [
        VERSION,
        currentKeyId,
        iv.toString("base64url"),
        cipher.getAuthTag().toString("base64url"),
        encrypted.toString("base64url"),
      ].join(".")
    },
    decrypt(payload, context) {
      const parts = typeof payload === "string" ? payload.split(".") : []
      const [version, keyId, iv, tag, encrypted] = parts
      if (parts.length !== 5 || version !== VERSION || !keyId || !iv || !tag || !encrypted) {
        throw new CredentialCipherError("Credencial cifrada em formato inválido")
      }
      const key = keyring.get(keyId)
      if (!key) throw new CredentialCipherError("Chave de cifra da credencial desconhecida")
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"))
        decipher.setAuthTag(Buffer.from(tag, "base64url"))
        if (context) decipher.setAAD(Buffer.from(context, "utf8"))
        return Buffer.concat([
          decipher.update(Buffer.from(encrypted, "base64url")),
          decipher.final(),
        ]).toString("utf8")
      } catch {
        throw new CredentialCipherError("Não foi possível decifrar a credencial")
      }
    },
  }
}

type CipherEnv = Readonly<Record<string, string | undefined>>

/**
 * Chaveiro a partir do ambiente. `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` é a chave corrente (id
 * `PAYMENT_CREDENTIALS_ENCRYPTION_KEY_ID`, padrão `k1`); para rotacionar, a chave antiga vai em
 * `..._KEY_PREVIOUS` (id `..._KEY_PREVIOUS_ID`, padrão `k0`) até todas as linhas serem regravadas.
 */
export function createCredentialCipherFromEnv(env: CipherEnv = process.env): CredentialCipher {
  const current = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY?.trim()
  if (!current) {
    throw new CredentialCipherError("PAYMENT_CREDENTIALS_ENCRYPTION_KEY não configurada")
  }
  const currentKeyId = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY_ID?.trim() || "k1"
  const keys: Record<string, string> = { [currentKeyId]: current }
  const previous = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS?.trim()
  if (previous) {
    const previousId = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS_ID?.trim() || "k0"
    if (previousId === currentKeyId) {
      throw new CredentialCipherError("O id da chave anterior deve diferir do id da chave corrente")
    }
    keys[previousId] = previous
  }
  return createCredentialCipher({ currentKeyId, keys })
}

export type CredentialValueDescription = {
  /** Null para valores curtos: mostrar 4 caracteres de um valor curto revelaria metade dele. */
  readonly last4: string | null
  /** SHA-256 truncado do valor inteiro; nunca um prefixo do valor. */
  readonly fingerprint: string
}

export function describeCredentialValue(value: string): CredentialValueDescription {
  const fingerprint = crypto
    .createHash("sha256")
    .update(`payment-credential:v1:${value}`, "utf8")
    .digest("hex")
    .slice(0, 12)
  return { last4: value.length >= MIN_LAST4_LENGTH ? value.slice(-4) : null, fingerprint }
}

function buildKeyring(keys: Readonly<Record<string, string>>): Map<string, Buffer> {
  const keyring = new Map<string, Buffer>()
  for (const [keyId, hex] of Object.entries(keys)) {
    if (!KEY_ID_PATTERN.test(keyId)) {
      throw new CredentialCipherError("Identificador de chave de cifra inválido")
    }
    if (typeof hex !== "string" || !HEX_KEY_PATTERN.test(hex)) {
      throw new CredentialCipherError("A chave de cifra deve ter 64 caracteres hexadecimais")
    }
    keyring.set(keyId, Buffer.from(hex, "hex"))
  }
  return keyring
}
