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

export function canCreateLeadFromExtracted(data: ExtractedLeadData): boolean {
  return Boolean(data.name && data.normalizedPhone)
}

export function canUpdateLeadFromExtracted(data: ExtractedLeadData): boolean {
  return Boolean(data.email || data.normalizedPhone)
}
