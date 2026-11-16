import crypto from "node:crypto"
import type {
  ProviderConfigVariable,
  ProviderConfigVariableInput,
} from "./routing-config"

const CIPHER_VERSION = "v1"

export type StoredProviderConfigVariable = {
  name: string
  visibility: "PUBLIC" | "SECRET"
  value: string
}

function encryptionKey(): Buffer {
  const source = process.env.ENCRYPTION_KEY?.trim()
  if (!source) throw new Error("ENCRYPTION_KEY é obrigatória para variáveis secretas de providers")
  return /^[0-9a-f]{64}$/i.test(source)
    ? Buffer.from(source, "hex")
    : crypto.createHash("sha256").update(source).digest()
}

function isStoredVariable(value: unknown): value is StoredProviderConfigVariable {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Partial<StoredProviderConfigVariable>
  return typeof candidate.name === "string" &&
    (candidate.visibility === "PUBLIC" || candidate.visibility === "SECRET") &&
    typeof candidate.value === "string"
}

export function readStoredProviderConfigVariables(value: unknown): StoredProviderConfigVariable[] {
  if (!Array.isArray(value)) return []
  return value.filter(isStoredVariable)
}

export function summarizeStoredProviderConfigVariables(
  value: unknown,
  legacyPublicKey?: string | null,
  legacyPublicKeyName = "ABACATE_PAY_DEV_PUBLIC_KEY",
): ProviderConfigVariable[] {
  const variables = readStoredProviderConfigVariables(value)
  if (legacyPublicKey?.trim() && !variables.some((item) => item.name.endsWith("_PUBLIC_KEY"))) {
    variables.push({
      name: legacyPublicKeyName,
      visibility: "PUBLIC",
      value: legacyPublicKey.trim(),
    })
  }
  return variables.map((item) => ({
    name: item.name,
    visibility: item.visibility,
    configured: true,
    ...(item.visibility === "PUBLIC" ? { value: item.value } : {}),
  }))
}

export function applyProviderConfigVariables(
  current: unknown,
  requested: readonly ProviderConfigVariableInput[],
): StoredProviderConfigVariable[] {
  const previous = new Map(readStoredProviderConfigVariables(current).map((item) => [item.name, item]))
  return requested.map((item) => {
    const value = item.value?.trim()
    const old = previous.get(item.name)
    if (item.visibility === "PUBLIC") {
      if (!value) throw new Error(`Informe um valor para ${item.name}`)
      return { name: item.name, visibility: item.visibility, value }
    }
    if (value) return { name: item.name, visibility: item.visibility, value: encryptSecret(value, item.name) }
    if (old?.visibility === "SECRET") return old
    throw new Error(`Informe um valor para o novo segredo ${item.name}`)
  })
}

export function resolveProviderConfigVariables(value: unknown): Record<string, string> {
  return Object.fromEntries(readStoredProviderConfigVariables(value).map((item) => [
    item.name,
    item.visibility === "SECRET" ? decryptSecret(item.value, item.name) : item.value,
  ]))
}

export function resolvePublicProviderConfigVariable(value: unknown, name: string): string | null {
  const variable = readStoredProviderConfigVariables(value).find((item) => item.name === name)
  return variable?.visibility === "PUBLIC" ? variable.value : null
}

function encryptSecret(value: string, name: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv)
  cipher.setAAD(Buffer.from(name, "utf8"))
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  return [CIPHER_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}

function decryptSecret(value: string, name: string): string {
  const [version, iv, tag, encrypted] = value.split(".")
  if (version !== CIPHER_VERSION || !iv || !tag || !encrypted) {
    throw new Error("Variável secreta de provider tem formato inválido")
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"))
  decipher.setAAD(Buffer.from(name, "utf8"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
