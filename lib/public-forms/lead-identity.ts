import { normalizeLeadPhoneDigits } from "@/lib/masks"
import { parseCurrencyBR } from "@/lib/public-forms/masks"
import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"

const nativeKeys = new Set([
  "name",
  "email",
  "phone",
  "cnpj",
  "age",
  "currentHealthPlan",
  "currentValue",
  "referenceHospital",
  "currentTreatment",
])

function valueText(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value ?? "")
}

export type ExtractedLeadData = {
  native: Record<string, string | number>
  custom: Record<string, unknown>
  notes: string[]
  name: string
  email: string
  phone: string
  normalizedPhone: string
}

export function extractLeadDataFromSnapshot(
  snapshot: PublicFormSnapshot,
  answers: PublicFormAnswerInput[],
  visibleIds?: Set<string>,
): ExtractedLeadData {
  const visible = visibleIds ?? new Set(snapshot.questions.map((question) => question.id))
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.value]))
  const native: Record<string, string | number> = {}
  const custom: Record<string, unknown> = {}
  const notes: string[] = []

  for (const question of snapshot.questions) {
    if (!visible.has(question.id) || !answerMap.has(question.id)) continue
    const value = answerMap.get(question.id)
    if (
      question.mappingTarget === "native_field" &&
      question.mappingKey &&
      nativeKeys.has(question.mappingKey)
    ) {
      if (question.mappingKey === "currentValue" || question.type === "currency") {
        const amount =
          typeof value === "number" && Number.isFinite(value)
            ? value
            : parseCurrencyBR(String(value ?? ""))
        if (Number.isFinite(amount) && amount >= 0) {
          native[question.mappingKey] = amount
        }
      } else {
        native[question.mappingKey] = valueText(value)
      }
    }
    if (question.mappingTarget === "custom_field" && question.mappingKey) {
      custom[question.mappingKey] = value
    }
    if (question.mappingTarget === "notes") {
      const text = valueText(value)
      const parts = text.split("\n")
      if (parts.length <= 1) {
        notes.push(`${question.title}: ${text}`)
      } else {
        const firstLine = `${question.title}: ${parts[0] ?? ""}`
        const continuation = parts
          .slice(1)
          .map((line) => `  ${line}`)
          .join("\n")
        notes.push(`${firstLine}\n${continuation}`)
      }
    }
    if (question.type === "email" && value !== undefined && value !== null && value !== "") {
      const emailText = valueText(value).trim().toLowerCase()
      if (emailText.includes("@") && !native.email) {
        native.email = emailText
      }
    }
  }

  const name = typeof native.name === "string" ? native.name.trim() : ""
  const email = typeof native.email === "string" ? native.email.trim().toLowerCase() : ""
  const phone = typeof native.phone === "string" ? native.phone : ""
  const normalizedPhone = phone ? normalizeLeadPhoneDigits(phone) : ""

  return { native, custom, notes, name, email, phone, normalizedPhone }
}

const ROLE_LOCAL_PARTS = new Set([
  "financeiro",
  "contato",
  "comercial",
  "rh",
  "adm",
  "admin",
  "atendimento",
  "sac",
  "vendas",
  "suporte",
  "noreply",
  "no-reply",
  "marketing",
  "fiscal",
  "compras",
  "secretaria",
])

const COMPANY_SUFFIX_RE = /\b(ltda|eireli|s\.?a\.?|s\/a|me|epp|ss)\b/i

function personNameWords(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter((word) => /[a-zA-ZÀ-ÿ]{2,}/.test(word))
}

export function isValidPersonLeadName(name: string, email?: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (trimmed.includes("@")) return false

  const emailNorm = email?.trim().toLowerCase()
  if (emailNorm) {
    if (trimmed.toLowerCase() === emailNorm) return false
    const local = emailNorm.split("@")[0] ?? ""
    // First names often match the local-part (Maria / maria@). Reject dotted copies only.
    const nameMatchesDottedEmailLocalPart =
      Boolean(local) && trimmed.toLowerCase() === local && local.includes(".")
    if (nameMatchesDottedEmailLocalPart) return false
  }

  if (COMPANY_SUFFIX_RE.test(trimmed)) return false
  if (/^[a-z0-9]+\.[a-z0-9.]+$/i.test(trimmed) && !trimmed.includes(" ")) return false

  const words = personNameWords(trimmed)
  if (words.length < 1) return false

  const firstWord = words[0]?.toLowerCase()
  if (firstWord && ROLE_LOCAL_PARTS.has(firstWord)) return false
  return true
}

export function isBrazilianMobilePhone(normalizedDigits: string): boolean {
  return /^\d{11}$/.test(normalizedDigits) && normalizedDigits[2] === "9"
}

export function isBrazilianLandlinePhone(normalizedDigits: string): boolean {
  // ANATEL: DDD + 8-digit subscriber starting 2–5. Rejects truncated mobiles (9…).
  return /^\d{2}[2-5]\d{7}$/.test(normalizedDigits)
}

export function isBrazilianContactPhone(normalizedDigits: string): boolean {
  return isBrazilianMobilePhone(normalizedDigits) || isBrazilianLandlinePhone(normalizedDigits)
}

export function canCreateLeadFromExtracted(data: ExtractedLeadData): boolean {
  if (!isValidPersonLeadName(data.name, data.email)) return false
  return isBrazilianContactPhone(data.normalizedPhone)
}

/** Gate A+C: nome de pessoa com ao menos uma palavra + telefone brasileiro válido. */
export const hasCrmGateAC = canCreateLeadFromExtracted

export function canUpdateLeadFromExtracted(data: ExtractedLeadData): boolean {
  return Boolean(data.email || data.normalizedPhone)
}

/** Motivos de descarte que o funil agrega (SPEC 40 E2/DA2). */
export const PUBLIC_FORM_LEAD_DISCARD_REASONS = [
  "sem_nome",
  "nome_invalido",
  "sem_telefone",
  "telefone_invalido",
  "sem_contato",
] as const

export type PublicFormLeadDiscardReason = (typeof PUBLIC_FORM_LEAD_DISCARD_REASONS)[number]

/**
 * Por que o gate recusou este lead — `null` quando não recusou.
 *
 * Espelha `canCreateLeadFromExtracted`/`canUpdateLeadFromExtracted` passo a
 * passo de propósito: o motivo precisa concordar com a decisão, senão o
 * contador de descartes conta uma população e o CRM cria outra. Vive ao lado do
 * gate para as duas regras mudarem juntas (`lead-discard-reason.test.ts` trava
 * o par em toda combinação de nome × telefone).
 */
export function resolveLeadDiscardReason(
  data: ExtractedLeadData,
  options: { hasMatchingLead: boolean },
): PublicFormLeadDiscardReason | null {
  if (options.hasMatchingLead) {
    return canUpdateLeadFromExtracted(data) ? null : "sem_contato"
  }
  if (!data.name.trim()) return "sem_nome"
  if (!isValidPersonLeadName(data.name, data.email)) return "nome_invalido"
  if (!data.normalizedPhone) return "sem_telefone"
  if (!isBrazilianContactPhone(data.normalizedPhone)) return "telefone_invalido"
  return null
}

const ANONYMOUS_RADAR_DISPLAY_NAME = "Visitante Anônimo"

export type RadarIdentityOverlay = {
  displayName?: string | null
  primaryEmail?: string | null
  displayPhone?: string | null
  normalizedPhone?: string | null
}

function usableRadarDisplayName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (!trimmed || trimmed === ANONYMOUS_RADAR_DISPLAY_NAME) return ""
  return trimmed
}

/** Completa name/email/phone do form com o perfil Radar já unificado. */
export function overlayRadarIdentityOnExtracted(
  extracted: ExtractedLeadData,
  overlay: RadarIdentityOverlay | null | undefined,
): ExtractedLeadData {
  if (!overlay) return extracted

  const name = extracted.name || usableRadarDisplayName(overlay.displayName)
  const email = extracted.email || (overlay.primaryEmail?.trim().toLowerCase() ?? "")
  let phone = extracted.phone
  let normalizedPhone = extracted.normalizedPhone
  if (!normalizedPhone) {
    const overlayDigits = normalizeLeadPhoneDigits(
      overlay.normalizedPhone || overlay.displayPhone || "",
    )
    if (overlayDigits) {
      phone = overlay.displayPhone?.trim() || extracted.phone
      normalizedPhone = overlayDigits
    }
  }

  return {
    ...extracted,
    name,
    email,
    phone,
    normalizedPhone,
    native: {
      ...extracted.native,
      ...(name && !extracted.native.name ? { name } : {}),
      ...(email && !extracted.native.email ? { email } : {}),
      ...(phone && !extracted.native.phone ? { phone } : {}),
    },
  }
}

export function isBlankPublicFormAnswerValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim() === ""
  return false
}

export function publicFormAnswerValueText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? value : null
}
