export const BACKOFFICE_EMAIL_DOMAIN = "@corretorstudio.com.br" as const

export const BACKOFFICE_EMAIL_HOSTED_DOMAIN = "corretorstudio.com.br" as const

export function normalizeBackofficeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isValidBackofficeEmail(email: string) {
  const normalized = normalizeBackofficeEmail(email)
  const prefix = normalized.endsWith(BACKOFFICE_EMAIL_DOMAIN)
    ? normalized.slice(0, -BACKOFFICE_EMAIL_DOMAIN.length)
    : ""

  return /^[^\s@]+$/.test(prefix) && normalized === `${prefix}${BACKOFFICE_EMAIL_DOMAIN}`
}

export function backofficeEmailDomainErrorMessage() {
  return `E-mail deve pertencer ao domínio ${BACKOFFICE_EMAIL_DOMAIN}`
}
