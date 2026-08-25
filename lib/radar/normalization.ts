import { sanitizeDocumentDigits } from "@/lib/masks"

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

/**
 * Normaliza para o padrão `55` + DDD + número, ou recusa.
 *
 * DA6 — ou é telefone, ou não entra no campo. Produção acumulou 242 JIDs de
 * grupo do WhatsApp (`120363…`, 18 dígitos) e 118 valores de 22-23 dígitos em
 * `RadarProfile.normalizedPhone` (auditoria CDP §4 R4), porque o ramo final
 * devolvia os dígitos crus para QUALQUER comprimento. Dois efeitos: o
 * `slice(-11)` da elegibilidade transformava esse lixo em "celular válido"
 * aleatório, e a unique `(teamId, normalizedPhone, normalizedName)` passou a
 * ser alimentada com identidade não-telefônica.
 *
 * A recusa devolve `""` — o mesmo sentinela já usado para "sem telefone", que
 * os chamadores existentes tratam. Identidade WhatsApp não-telefônica continua
 * viva em `RadarIdentity type=whatsapp_contact_id`, que é o lugar dela.
 */
export function normalizeRadarPhone(phone: string | null | undefined): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")

  // Com DDI: 55 + DDD (2) + número (8 ou 9).
  if (digits.startsWith("55")) {
    return digits.length === 12 || digits.length === 13 ? digits : ""
  }

  // Sem DDI: DDD (2) + número (8 ou 9).
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return ""
}

/**
 * `true` quando o valor tem dígitos mas não é um telefone BR plausível.
 *
 * Separa "lixo a preservar antes de limpar" de "simplesmente não tem
 * telefone": o saneamento move o artefato para `profileData.rawPhoneArtifacts`
 * antes de anular o campo; ausência não tem nada a preservar.
 */
export function isRadarPhoneArtifact(phone: string | null | undefined): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 0) return false
  return normalizeRadarPhone(phone) === ""
}

export function normalizeRadarName(name: string | null | undefined): string {
  if (!name) return ""
  return stripAccents(name.trim().toLowerCase()).replace(/\s+/g, " ")
}

export function normalizeRadarEmail(email: string | null | undefined): string {
  if (!email) return ""
  return email.trim().toLowerCase()
}

export function normalizeRadarDocument(document: string | null | undefined): string {
  if (!document) return ""
  return sanitizeDocumentDigits(document)
}

export function isValidRadarPrimaryIdentity(
  phone: string | null | undefined,
  name: string | null | undefined
): boolean {
  const normalizedPhone = normalizeRadarPhone(phone)
  const normalizedName = normalizeRadarName(name)
  return normalizedPhone.length >= 12 && normalizedName.length > 0
}

export function formatDisplayPhone(phone: string | null | undefined): string {
  const normalized = normalizeRadarPhone(phone)
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
