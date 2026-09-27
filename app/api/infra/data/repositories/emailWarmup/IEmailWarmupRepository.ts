import type { EmailWarmupState } from "@/lib/email/warmup-policy"

export type EmailWarmupReservation = EmailWarmupState & {
  accepted: number
  deferred: number
}

export interface IEmailWarmupRepository {
  getState(teamId: string, now?: Date): Promise<EmailWarmupState>
  reserve(teamId: string, requested: number, now?: Date): Promise<EmailWarmupReservation>
}
