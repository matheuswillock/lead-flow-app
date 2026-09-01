import { EMAIL_LOG_FORM_QUERY_PARAM } from "@/lib/email/append-email-log-to-form-urls"

export { EMAIL_LOG_FORM_QUERY_PARAM }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const FORM_START_ACTIVITY_BODY = "Início do preenchimento do formulário"
// O par de conclusão ("Fim do preenchimento do formulário") saiu daqui: a
// atividade agora traz identidade e respostas, em
// `lib/public-forms/form-completion-activity.ts`.
export const EMAIL_CAMPAIGN_LEAD_CREATED_ACTIVITY_PREFIX =
  "Lead criado via atribuição de campanha de e-mail"

export function formatEmailCampaignLeadCreatedActivityBody(
  campaignName?: string | null
): string {
  const trimmed = campaignName?.trim()
  if (!trimmed) return EMAIL_CAMPAIGN_LEAD_CREATED_ACTIVITY_PREFIX
  return `${EMAIL_CAMPAIGN_LEAD_CREATED_ACTIVITY_PREFIX} [${trimmed}]`
}

export type EmailCampaignAttributionOrigin = {
  emailLogId?: string
  campaignId?: string
  recipientEmail?: string
}

export function parseRecipientEmailFromOrigin(
  origin: Record<string, unknown> | null | undefined
): string | null {
  if (!origin || typeof origin !== "object") return null
  const raw = origin.recipientEmail
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  if (!email || !email.includes("@") || email.includes(" ")) return null
  return email
}

export function parseEmailLogIdFromOrigin(origin: Record<string, unknown> | null | undefined): string | null {
  if (!origin || typeof origin !== "object") return null
  const raw =
    (typeof origin.emailLogId === "string" && origin.emailLogId) ||
    (typeof origin[EMAIL_LOG_FORM_QUERY_PARAM] === "string" && origin[EMAIL_LOG_FORM_QUERY_PARAM]) ||
    null
  if (!raw) return null
  const trimmed = raw.trim()
  return UUID_RE.test(trimmed) ? trimmed : null
}

export function extractPhoneFromCustomFields(
  customFields: Record<string, unknown> | null | undefined
): string | null {
  if (!customFields || typeof customFields !== "object") return null
  const keys = ["phone", "telefone", "celular", "mobile", "whatsapp"]
  for (const key of keys) {
    const value = customFields[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  for (const [key, value] of Object.entries(customFields)) {
    if (!/phone|telefone|celular|whatsapp|mobile/i.test(key)) continue
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export function resolveAttributionDisplayName(
  recipientName: string | null | undefined,
  recipientEmail: string
): string {
  const name = recipientName?.trim()
  if (name) return name
  const local = recipientEmail.split("@")[0]?.trim()
  return local && local.length > 0 ? local : recipientEmail
}
