import { randomBytes } from "crypto"

/**
 * Normalizes a phone string to digits only (E.164 without +).
 * Examples: "(11) 99999-9999" → "5511999999999", "+55 11 99999-9999" → "5511999999999"
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

/**
 * Returns "YYYY-MM" for the given date (defaults to current date).
 * Example: "2026-06"
 */
export function buildPeriodKey(date?: Date): string {
  const d = date ?? new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

/**
 * Returns a cryptographically random 32-character hex string to use as webhook secret.
 */
export function generateWebhookSecret(): string {
  return randomBytes(16).toString("hex")
}
