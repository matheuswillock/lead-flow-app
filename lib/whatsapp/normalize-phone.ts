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
