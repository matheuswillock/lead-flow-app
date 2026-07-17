/**
 * Resolução do From de campanhas conforme domínio e remetente do time.
 *
 * Regras:
 * - Com remetente padrão → usar nome/e-mail do remetente
 * - Sem remetente + domínio do time → deliveryby@[domínio]
 * - Sem remetente + sem domínio → deliveryby@corretorstudio.com
 */

export const PLATFORM_FROM_DOMAIN = "corretorstudio.com"
export const DELIVERY_LOCAL_PART = "deliveryby"
export const PLATFORM_FROM_NAME = "Corretor Studio"
export const PLATFORM_FROM_EMAIL = `${DELIVERY_LOCAL_PART}@${PLATFORM_FROM_DOMAIN}`

/** Defaults legados ainda presentes em rows antigas */
const LEGACY_PLATFORM_FROM_EMAILS = new Set([
  PLATFORM_FROM_EMAIL.toLowerCase(),
  "no-reply@corretorstudio.com",
])

export type ResolveCampaignFromInput = {
  domainName?: string | null
  defaultSender?: { name: string; email: string } | null
  legacyFromName?: string | null
  legacyFromEmail?: string | null
}

export type ResolvedCampaignFrom = {
  fromName: string
  fromEmail: string
}

export function isPlatformDefaultFromEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return true
  return LEGACY_PLATFORM_FROM_EMAILS.has(email.trim().toLowerCase())
}

export function buildDeliveryFromEmail(domainName: string | null | undefined): string {
  const domain = domainName?.trim().toLowerCase()
  if (!domain) return PLATFORM_FROM_EMAIL
  return `${DELIVERY_LOCAL_PART}@${domain}`
}

/**
 * Valida se o e-mail do remetente pertence ao domínio cadastrado no Resend
 * (igual ao domínio ou subdomínio dele).
 */
export function isEmailAllowedForTeamDomain(
  email: string,
  domainName: string | null | undefined
): boolean {
  const domain = domainName?.trim().toLowerCase()
  if (!domain) return true

  const normalizedEmail = email.trim().toLowerCase()
  const at = normalizedEmail.lastIndexOf("@")
  if (at < 0) return false
  const host = normalizedEmail.slice(at + 1)
  return host === domain || host.endsWith(`.${domain}`)
}

export function resolveCampaignFrom(input: ResolveCampaignFromInput): ResolvedCampaignFrom {
  const senderName = input.defaultSender?.name?.trim()
  const senderEmail = input.defaultSender?.email?.trim()

  if (senderName && senderEmail) {
    return {
      fromName: senderName,
      fromEmail: senderEmail.toLowerCase(),
    }
  }

  const legacyEmail = input.legacyFromEmail?.trim() || null
  const legacyName = input.legacyFromName?.trim() || null

  // From legado customizado (não-plataforma), sem row de sender — preserva
  if (legacyEmail && !isPlatformDefaultFromEmail(legacyEmail)) {
    return {
      fromName: legacyName || PLATFORM_FROM_NAME,
      fromEmail: legacyEmail.toLowerCase(),
    }
  }

  return {
    fromName: legacyName || PLATFORM_FROM_NAME,
    fromEmail: buildDeliveryFromEmail(input.domainName),
  }
}

export function formatCampaignFromHeader(from: ResolvedCampaignFrom): string {
  return `${from.fromName} <${from.fromEmail}>`
}
