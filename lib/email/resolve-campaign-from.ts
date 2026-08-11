/**
 * Resolução do From de campanhas conforme domínio e remetente do time.
 *
 * Regras:
 * - Com remetente padrão → usar nome/e-mail do remetente
 * - Sem remetente + domínio do time → deliveryby@[domínio]
 * - Sem remetente + sem domínio → deliveryby@corretorstudio.com
 */

import { isResendDomainSendCapable } from "@/lib/email/campaign-dispatch-guards"

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

export const CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE =
  "Domínio de e-mail não verificado no Resend. Verifique o domínio nas configurações antes de disparar."

export const CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE =
  "O remetente da campanha não pertence ao domínio verificado no Resend."

export const SENDER_EMAIL_DOMAIN_NOT_VERIFIED_MESSAGE =
  "Domínio de e-mail não verificado. Verifique o domínio nas configurações antes de cadastrar um remetente."

export const SENDER_EMAIL_OUTSIDE_DOMAIN_MESSAGE =
  "O e-mail do remetente deve usar o domínio cadastrado e verificado no Resend."

export type CampaignFromSendableCheck =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Guard de domínio: impede disparo quando o "from" da campanha não pode ser
 * enviado de forma segura. E-mails no domínio da plataforma
 * (`@corretorstudio.com`, incl. deliveryby/no-reply) passam sempre. Qualquer
 * outro from exige um domínio do time verificado no Resend e pertencente ao
 * remetente.
 */
export function assertCampaignFromIsSendable(params: {
  resolved: ResolvedCampaignFrom
  domainName?: string | null | undefined
  domainStatus?: string | null | undefined
}): CampaignFromSendableCheck {
  if (
    isPlatformDefaultFromEmail(params.resolved.fromEmail) ||
    isEmailOnPlatformDomain(params.resolved.fromEmail)
  ) {
    return { ok: true }
  }

  const domainCapable =
    Boolean(params.domainName?.trim()) && isResendDomainSendCapable(params.domainStatus)
  if (!domainCapable) {
    return { ok: false, message: CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE }
  }

  if (!isEmailAllowedForTeamDomain(params.resolved.fromEmail, params.domainName)) {
    return { ok: false, message: CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE }
  }

  return { ok: true }
}

/**
 * Mesma regra de negócio de `assertCampaignFromIsSendable`, com mensagens
 * orientadas ao cadastro/edição de remetente (não ao disparo).
 */
export function assertSenderEmailIsAllowed(params: {
  email: string
  domainName?: string | null | undefined
  domainStatus?: string | null | undefined
}): CampaignFromSendableCheck {
  const check = assertCampaignFromIsSendable({
    resolved: { fromName: "sender", fromEmail: params.email },
    domainName: params.domainName,
    domainStatus: params.domainStatus,
  })
  if (check.ok) return check
  if (check.message === CAMPAIGN_FROM_DOMAIN_NOT_VERIFIED_MESSAGE) {
    return { ok: false, message: SENDER_EMAIL_DOMAIN_NOT_VERIFIED_MESSAGE }
  }
  if (check.message === CAMPAIGN_FROM_SENDER_OUTSIDE_DOMAIN_MESSAGE) {
    const domain = params.domainName?.trim().toLowerCase()
    return {
      ok: false,
      message: domain
        ? `O e-mail do remetente deve usar o domínio cadastrado (@${domain})`
        : SENDER_EMAIL_OUTSIDE_DOMAIN_MESSAGE,
    }
  }
  return check
}

export function isPlatformDefaultFromEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return true
  return LEGACY_PLATFORM_FROM_EMAILS.has(email.trim().toLowerCase())
}

/** Qualquer e-mail no domínio (ou subdomínio) da plataforma Corretor Studio. */
export function isEmailOnPlatformDomain(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf("@")
  if (at < 0) return false
  const host = normalized.slice(at + 1)
  return host === PLATFORM_FROM_DOMAIN || host.endsWith(`.${PLATFORM_FROM_DOMAIN}`)
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
