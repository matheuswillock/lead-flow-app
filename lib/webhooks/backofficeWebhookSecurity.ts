import crypto from "crypto"
import { addMonths } from "date-fns"

export type BackofficeWebhookTokenExpiryModeValue =
  | "hours_24"
  | "months_6"
  | "indeterminate"

const BACKOFFICE_WEBHOOK_TOKEN_CIPHER_VERSION = "v1"
const BACKOFFICE_WEBHOOK_TOKEN_DEV_SECRET = "lead-flow-backoffice-webhook-dev-secret"

function resolveBackofficeWebhookTokenSecret(): string | null {
  const encryptionSecret = process.env.ENCRYPTION_KEY?.trim()
  if (encryptionSecret) return encryptionSecret

  const serviceRoleSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceRoleSecret) return serviceRoleSecret

  const databaseSecret = process.env.DATABASE_URL?.trim()
  if (databaseSecret) return databaseSecret

  if (process.env.NODE_ENV !== "production") return BACKOFFICE_WEBHOOK_TOKEN_DEV_SECRET

  return null
}

function resolveBackofficeWebhookTokenCipherKey(): Buffer | null {
  const secret = resolveBackofficeWebhookTokenSecret()
  if (!secret) return null

  return crypto.createHash("sha256").update(secret).digest()
}

export function generateBackofficeWebhookToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function hashBackofficeWebhookToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export function encryptBackofficeWebhookToken(token: string): string | null {
  if (!token) return null

  const key = resolveBackofficeWebhookTokenCipherKey()
  if (!key) return null

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encryptedBuffer = Buffer.concat([cipher.update(token, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    BACKOFFICE_WEBHOOK_TOKEN_CIPHER_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encryptedBuffer.toString("base64url"),
  ].join(".")
}

export function decryptBackofficeWebhookToken(
  tokenCipher: string | null | undefined
): string | null {
  if (!tokenCipher) return null

  const key = resolveBackofficeWebhookTokenCipherKey()
  if (!key) return null

  const [version, ivPart, authTagPart, encryptedPart] = tokenCipher.split(".")
  if (
    version !== BACKOFFICE_WEBHOOK_TOKEN_CIPHER_VERSION ||
    !ivPart ||
    !authTagPart ||
    !encryptedPart
  ) {
    return null
  }

  try {
    const iv = Buffer.from(ivPart, "base64url")
    const authTag = Buffer.from(authTagPart, "base64url")
    const encryptedBuffer = Buffer.from(encryptedPart, "base64url")
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(authTag)
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
    return decryptedBuffer.toString("utf8")
  } catch {
    return null
  }
}

export function safeBackofficeWebhookTokenEquals(
  providedToken: string,
  expectedTokenHash: string
): boolean {
  if (!providedToken || !expectedTokenHash) return false

  const providedHash = hashBackofficeWebhookToken(providedToken)
  const providedBuffer = Buffer.from(providedHash, "hex")
  const expectedBuffer = Buffer.from(expectedTokenHash, "hex")

  if (providedBuffer.length !== expectedBuffer.length) return false

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

export function buildBackofficeWebhookTokenPreview(token: string): string {
  if (!token) return ""
  if (token.length <= 12) return token
  return `${token.slice(0, 8)}...${token.slice(-4)}`
}

export function computeBackofficeWebhookTokenExpiry(
  mode: BackofficeWebhookTokenExpiryModeValue,
  now: Date = new Date()
): Date | null {
  if (mode === "indeterminate") return null
  if (mode === "hours_24") return new Date(now.getTime() + 24 * 60 * 60 * 1000)

  return addMonths(now, 6)
}

export function isBackofficeWebhookTokenExpired(
  expiresAt?: Date | null,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() <= now.getTime()
}

export function sanitizeBackofficeWebhookEndpointForLogs(pathname: string): string {
  const normalizedPath = pathname.split("?")[0]
  return normalizedPath.replace(
    /^\/api\/webhooks\/backoffice\/meta\/[^/]+\/lead$/,
    "/api/webhooks/backoffice/meta/[token]/lead"
  )
}
