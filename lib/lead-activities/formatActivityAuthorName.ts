import { isCorretorStudioStaffEmail } from "@/lib/backoffice/email-domain"

export const SUPPORT_AUTHOR_LABEL = "Equipe de suporte"

type ActivityAuthorLike = {
  fullName?: string | null
  email?: string | null
}

/**
 * Nome do autor no histórico. Quem é da equipe Corretor Studio aparece como
 * "Fulano · Equipe de suporte", para o corretor saber quem alterou o quê.
 */
export function formatActivityAuthorName(
  author: ActivityAuthorLike | null | undefined,
  fallback = "Sistema"
): string {
  const name = author?.fullName?.trim() || author?.email?.trim()
  if (!name) return fallback

  return isCorretorStudioStaffEmail(author?.email) ? `${name} · ${SUPPORT_AUTHOR_LABEL}` : name
}
