import { sanitizeDocumentDigits } from "@/lib/masks"

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

export function normalizeCdpPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

export function normalizeCdpName(name: string | null | undefined): string {
  if (!name) return ""
  return stripAccents(name.trim().toLowerCase()).replace(/\s+/g, " ")
}

export function normalizeCdpEmail(email: string | null | undefined): string {
  if (!email) return ""
  return email.trim().toLowerCase()
}

export function normalizeCdpDocument(document: string | null | undefined): string {
  if (!document) return ""
  return sanitizeDocumentDigits(document)
}

export function isValidCdpPrimaryIdentity(
  phone: string | null | undefined,
  name: string | null | undefined
): boolean {
  const normalizedPhone = normalizeCdpPhone(phone)
  const normalizedName = normalizeCdpName(name)
  return normalizedPhone.length >= 12 && normalizedName.length > 0
}

export function formatDisplayPhone(phone: string | null | undefined): string {
  const normalized = normalizeCdpPhone(phone)
  if (!normalized) return ""
  if (normalized.length === 13 && normalized.startsWith("55")) {
    const local = normalized.slice(2)
    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
    }
    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
    }
  }
  return phone?.trim() ?? normalized
}
