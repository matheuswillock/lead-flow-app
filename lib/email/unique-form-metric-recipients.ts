export function uniqueFormMetricRecipientKey(row: {
  visitorSessionId: string
  origin: unknown
}): string {
  const origin =
    row.origin && typeof row.origin === "object" && !Array.isArray(row.origin)
      ? (row.origin as Record<string, unknown>)
      : null

  const email =
    typeof origin?.recipientEmail === "string" ? origin.recipientEmail.trim().toLowerCase() : ""
  if (email) return `email:${email}`

  const emailLogId =
    typeof origin?.emailLogId === "string" ? origin.emailLogId.trim() : ""
  if (emailLogId) return `log:${emailLogId}`

  return `session:${row.visitorSessionId}`
}

export function countUniqueFormMetricRecipients(
  rows: Array<{ visitorSessionId: string; origin: unknown }>,
): number {
  const keys = new Set<string>()
  for (const row of rows) keys.add(uniqueFormMetricRecipientKey(row))
  return keys.size
}
