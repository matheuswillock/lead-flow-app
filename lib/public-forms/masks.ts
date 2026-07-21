/**
 * Format and parse helpers for public form phone/currency inputs (pt-BR).
 */

export function formatPhoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Digits-only input → pt-BR money string without R$ prefix (e.g. 1.234,56). */
export function formatCurrencyBR(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return ""
  const num = Number.parseInt(digits, 10) / 100
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseCurrencyBR(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
  const num = Number.parseFloat(normalized)
  return Number.isFinite(num) ? num : 0
}

export function phoneDigitCount(value: string): number {
  return value.replace(/\D/g, "").length
}
