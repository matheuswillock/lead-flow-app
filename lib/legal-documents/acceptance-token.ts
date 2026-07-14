import { createHash, randomBytes } from "node:crypto"

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function generateAcceptanceToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashAcceptanceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function acceptanceTokenPreview(token: string): string {
  return `${token.slice(0, 5)}…${token.slice(-4)}`
}

export function acceptanceTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + TOKEN_TTL_MS)
}

