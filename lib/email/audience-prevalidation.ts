import {
  isValidResendRecipientEmail,
  normalizeResendRecipientEmail,
  type ResendRecipientEmailValidation,
} from "@/lib/email/is-valid-resend-recipient-email"

export const AUDIENCE_TYPO_DOMAINS = [
  "gmail.com.br",
  "gamil.com",
  "gamil.com.br",
  "gmal.com",
  "gmial.com",
  "gmaill.com",
  "gnail.com",
  "gmail.con",
  "gmail.cm",
  "gmail.co",
  "hotmai.com",
  "hotmal.com",
  "homail.com",
  "hormail.com",
  "outlok.com",
  "yahooo.com",
  "yahooo.com.br",
] as const

export const AUDIENCE_DEAD_ISP_DOMAINS = [
  "ig.com.br",
  "superig.com.br",
  "bol.com.br",
  "brturbo.com.br",
  "ibest.com.br",
  "zipmail.com.br",
  "click21.com.br",
] as const

export const AUDIENCE_ROLE_LOCAL_PARTS = [
  "admin",
  "info",
  "contato",
  "contact",
  "financeiro",
  "comercial",
  "sac",
  "noreply",
  "no-reply",
  "webmaster",
  "postmaster",
  "abuse",
  "sales",
  "support",
  "suporte",
  "marketing",
  "rh",
  "compras",
  "vendas",
  "atendimento",
  "secretaria",
  "office",
  "hello",
  "mail",
  "email",
] as const

const TYPO_DOMAIN_SET = new Set<string>(AUDIENCE_TYPO_DOMAINS)
const DEAD_ISP_DOMAIN_SET = new Set<string>(AUDIENCE_DEAD_ISP_DOMAINS)
const ROLE_LOCAL_PART_SET = new Set<string>(AUDIENCE_ROLE_LOCAL_PARTS)

export const AUDIENCE_REASON_TYPO_DOMAIN = "Domínio com erro de digitação"
export const AUDIENCE_REASON_DEAD_ISP = "Provedor de e-mail desativado"
export const AUDIENCE_REASON_ROLE = "Endereço genérico não permitido"
export const AUDIENCE_REASON_BOUNCED = "E-mail com bounce anterior"

export type AudienceEmailValidation = ResendRecipientEmailValidation

export type AudienceEmailFlags = {
  isGloballyBounced?: boolean
}

export function splitAudienceEmailParts(email: string): {
  localPart: string
  domain: string
} {
  const normalized = normalizeResendRecipientEmail(email)
  const atIndex = normalized.lastIndexOf("@")
  if (atIndex <= 0) {
    return { localPart: normalized, domain: "" }
  }
  return {
    localPart: normalized.slice(0, atIndex),
    domain: normalized.slice(atIndex + 1),
  }
}

export function isAudienceTypoDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase()
  if (!normalized) return false
  if (TYPO_DOMAIN_SET.has(normalized)) return true
  return normalized.endsWith(".combr")
}

export function isAudienceDeadIspDomain(domain: string): boolean {
  return DEAD_ISP_DOMAIN_SET.has(domain.trim().toLowerCase())
}

export function isAudienceRoleLocalPart(localPart: string): boolean {
  return ROLE_LOCAL_PART_SET.has(localPart.trim().toLowerCase())
}

export function hasInvalidAudienceLocalPartDots(localPart: string): boolean {
  return (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  )
}

/** Recusa de ingresso (preview, CSV, add, dispatch). */
export function evaluateEmailForAudience(
  value: string | null | undefined
): AudienceEmailValidation {
  const syntax = isValidResendRecipientEmail(value)
  if (!syntax.ok) return syntax

  const { localPart, domain } = splitAudienceEmailParts(syntax.email)

  if (isAudienceTypoDomain(domain)) {
    return { ok: false, reason: AUDIENCE_REASON_TYPO_DOMAIN }
  }

  if (isAudienceDeadIspDomain(domain)) {
    return { ok: false, reason: AUDIENCE_REASON_DEAD_ISP }
  }

  if (isAudienceRoleLocalPart(localPart)) {
    return { ok: false, reason: AUDIENCE_REASON_ROLE }
  }

  return syntax
}

export function evaluateEmailForAudienceWithFlags(
  value: string | null | undefined,
  flags: AudienceEmailFlags = {}
): AudienceEmailValidation {
  const evaluated = evaluateEmailForAudience(value)
  if (!evaluated.ok) return evaluated
  if (flags.isGloballyBounced) {
    return { ok: false, reason: AUDIENCE_REASON_BOUNCED }
  }
  return evaluated
}

export function filterEmailsForAudience(
  emails: string[],
  bouncedEmails: ReadonlySet<string> = new Set()
): string[] {
  const kept: string[] = []
  for (const email of emails) {
    const evaluated = evaluateEmailForAudienceWithFlags(email, {
      isGloballyBounced: bouncedEmails.has(normalizeResendRecipientEmail(email)),
    })
    if (evaluated.ok) kept.push(evaluated.email)
  }
  return kept
}

/**
 * Stamp histórico: typo, ISP morto e sintaxe de ponto no local-part.
 * Role e bounce não entram aqui.
 */
export function isInvalidStaticAudienceEmail(value: string | null | undefined): boolean {
  const email = normalizeResendRecipientEmail(value ?? "")
  if (!email.includes("@")) return false

  const { localPart, domain } = splitAudienceEmailParts(email)
  if (!domain) return false
  if (isAudienceTypoDomain(domain)) return true
  if (isAudienceDeadIspDomain(domain)) return true
  return hasInvalidAudienceLocalPartDots(localPart)
}

/** Domínios do stamp histórico — a migration SQL deve listar os mesmos literais. */
export function audienceStampSqlDomainLiterals(): string[] {
  return [...AUDIENCE_TYPO_DOMAINS, ...AUDIENCE_DEAD_ISP_DOMAINS]
}
