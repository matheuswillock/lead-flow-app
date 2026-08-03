import { randomBytes } from "node:crypto"

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

export function generateShortCode(length = 7): string {
  const bytes = randomBytes(length)
  return Array.from(bytes)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("")
}
