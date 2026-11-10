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

export function isCorretorStudioStaffEmail(email: string | null | undefined) {
  return typeof email === "string" && normalizeBackofficeEmail(email).endsWith(BACKOFFICE_EMAIL_DOMAIN)
}

/**
 * Filtro Prisma para `Profile`: deixa de fora a equipe Corretor Studio.
 * Usado nas contagens de usuário cobrado, que nunca incluem o suporte.
 */
export const EXCLUDE_CORRETOR_STUDIO_STAFF_PROFILE_FILTER = {
  NOT: { email: { endsWith: BACKOFFICE_EMAIL_DOMAIN, mode: "insensitive" } },
} as const

export function backofficeEmailDomainErrorMessage() {
  return `E-mail deve pertencer ao domínio ${BACKOFFICE_EMAIL_DOMAIN}`
}
