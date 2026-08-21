import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation"
import { normalizeRadarName, normalizeRadarPhone } from "@/lib/radar/normalization"
import { isBrazilianContactPhone, isValidPersonLeadName } from "@/lib/public-forms/lead-identity"
import { normalizeLeadPhoneDigits } from "@/lib/masks"

/**
 * Projeção de identidade derivada de uma resposta materializada.
 *
 * `mappingKey` prevalece sobre o tipo visual da pergunta — o tipo nunca é
 * consultado aqui. Somente `name`, `phone` e `email` afetam identidade; qualquer
 * outra resposta materializa sem tocar nos campos do gate.
 */

export type RadarIdentityField = "name" | "phone" | "email"

export type PublicFormIdentityProjection = {
  field: RadarIdentityField
  patch: Record<string, string>
} | null

/** Converte o valor JSON tipado em texto apenas na fronteira da identidade. */
export function publicFormIdentityValueText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

export function projectPublicFormAnswerIdentity(input: {
  mappingKey: string | null
  value: unknown
  /** Usado só para rejeitar um nome que repete o e-mail já conhecido do perfil. */
  currentPrimaryEmail: string | null
}): PublicFormIdentityProjection {
  const text = publicFormIdentityValueText(input.value)
  if (!text) return null

  if (input.mappingKey === "name") {
    if (!isValidPersonLeadName(text, input.currentPrimaryEmail ?? undefined)) return null
    return {
      field: "name",
      patch: { displayName: text, normalizedName: normalizeRadarName(text) },
    }
  }

  if (input.mappingKey === "phone") {
    // Mesma validação do gate: telefone inválido nunca vira identidade
    // materializada, senão o perfil ficaria elegível com lixo.
    if (!isBrazilianContactPhone(normalizeLeadPhoneDigits(text))) return null
    const normalizedPhone = normalizeRadarPhone(text)
    if (!normalizedPhone) return null
    return {
      field: "phone",
      patch: { displayPhone: text, normalizedPhone },
    }
  }

  if (input.mappingKey === "email") {
    const validation = evaluateEmailForAudience(text)
    if (!validation.ok) return null
    return {
      field: "email",
      patch: { primaryEmail: text, normalizedPrimaryEmail: validation.email },
    }
  }

  return null
}
