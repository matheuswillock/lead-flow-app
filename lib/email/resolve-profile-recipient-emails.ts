export type ProfileRecipientKind = "account" | "google"

export interface ProfileRecipientEmail {
  email: string
  kind: ProfileRecipientKind
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

export function resolveProfileRecipientEmails(input: {
  accountEmail: string
  googleEmail?: string | null
}): ProfileRecipientEmail[] {
  const account = normalizeEmail(input.accountEmail)
  if (!account) return []

  const recipients: ProfileRecipientEmail[] = [{ email: account, kind: "account" }]
  const google = normalizeEmail(input.googleEmail)

  if (google && google !== account) {
    recipients.push({ email: google, kind: "google" })
  }

  return recipients
}

export function inferRecipientKind(
  recipientEmail: string,
  profileRecipients: ProfileRecipientEmail[]
): ProfileRecipientKind | "external" {
  const normalized = normalizeEmail(recipientEmail)
  if (!normalized) return "external"

  const match = profileRecipients.find((item) => item.email === normalized)
  return match?.kind ?? "external"
}
