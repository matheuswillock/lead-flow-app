/**
 * Resolve a origem do descadastro (campanha + assunto do e-mail) para contatos da blocklist.
 */

export type ContactUnsubscribeSource = {
  campaignId: string | null
  campaignName: string | null
  subject: string | null
  unsubscribedAt: string
}

export type UnsubscribeSourceCandidate = {
  recipientEmail: string
  campaignId: string | null
  campaignName: string | null
  subject: string
  occurredAt: Date
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Mantém o evento `unsubscribed` mais recente por destinatário. */
export function mapUnsubscribeSourcesByEmail(
  candidates: UnsubscribeSourceCandidate[]
): Map<string, ContactUnsubscribeSource> {
  const byEmail = new Map<string, ContactUnsubscribeSource>()

  const sorted = [...candidates].sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
  )

  for (const candidate of sorted) {
    const email = normalizeEmail(candidate.recipientEmail)
    if (!email || byEmail.has(email)) continue
    byEmail.set(email, {
      campaignId: candidate.campaignId,
      campaignName: candidate.campaignName,
      subject: candidate.subject,
      unsubscribedAt: candidate.occurredAt.toISOString(),
    })
  }

  return byEmail
}

export function attachUnsubscribeSourceToContacts<T extends { email: string }>(
  contacts: T[],
  sourcesByEmail: Map<string, ContactUnsubscribeSource>
): Array<T & { unsubscribeSource: ContactUnsubscribeSource | null }> {
  return contacts.map((contact) => ({
    ...contact,
    unsubscribeSource: sourcesByEmail.get(normalizeEmail(contact.email)) ?? null,
  }))
}
