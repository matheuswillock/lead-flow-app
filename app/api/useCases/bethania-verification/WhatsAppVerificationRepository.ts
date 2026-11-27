export type WhatsAppVerificationChallenge = {
  id: string
  profileId: string
  phone: string
  codeHash: string
  expiresAt: Date
  attempts: number
  consumedAt: Date | null
  createdAt: Date
}

export type IssueWhatsAppChallengeInput = {
  supabaseId: string
  id: string
  phone: string
  codeHash: string
  createdAt: Date
  expiresAt: Date
}

export interface WhatsAppVerificationRepository {
  issueChallenge(input: IssueWhatsAppChallengeInput): Promise<{ id: string; profileId: string; phone: string } | null>
  invalidateChallenge(id: string, now: Date): Promise<void>
  findChallenge(supabaseId: string, id: string): Promise<WhatsAppVerificationChallenge | null>
  incrementFailedAttempt(input: {
    supabaseId: string
    id: string
    expectedAttempts: number
    now: Date
  }): Promise<void>
  consumeAndSetPhone(input: {
    supabaseId: string
    id: string
    phone: string
    expectedAttempts: number
    maxAttempts: number
    now: Date
  }): Promise<boolean>
}