import { createHash, randomBytes } from "node:crypto"

export const OFFER_SHARE_TTL_MS = 24 * 60 * 60 * 1000

export function generateOfferShareToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashOfferShareToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex")
}

export function getOfferShareExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + OFFER_SHARE_TTL_MS)
}

export function isOfferShareExpired(expiresAt?: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() <= now.getTime()
}
