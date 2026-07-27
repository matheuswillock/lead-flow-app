export const BACKOFFICE_DELETION_APPROVER_EMAILS = [
  "matheuswillock@corretorstudio.com.br",
  "bruno@corretorstudio.com.br",
] as const

export type BackofficeDeletionApproverEmail =
  (typeof BACKOFFICE_DELETION_APPROVER_EMAILS)[number]

export function isBackofficeDeletionApproverEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  return BACKOFFICE_DELETION_APPROVER_EMAILS.some((e) => e === normalized)
}
