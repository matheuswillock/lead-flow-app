import type {
  BackofficeEmailDispatch,
  BackofficeEmailDispatchCategory,
  BackofficeEmailDispatchEventType,
  BackofficeEmailDispatchProvider,
  BackofficeEmailRecipientKind,
  BackofficeEmailDispatchStatus,
  Prisma,
} from "@prisma/client"

export type BackofficeEmailDispatchRecord = BackofficeEmailDispatch

export interface CreateBackofficeEmailDispatchRepositoryInput {
  id: string
  profileId: string
  recipientEmail: string
  recipientKind: BackofficeEmailRecipientKind
  provider: BackofficeEmailDispatchProvider
  category: BackofficeEmailDispatchCategory
  subject: string
  sourceType?: string | null
  sourceId?: string | null
}

export interface RecordGoogleDispatchRepositoryInput {
  id: string
  profileId: string
  recipientEmail: string
  recipientKind: BackofficeEmailRecipientKind
  category: BackofficeEmailDispatchCategory
  subject: string
  sourceType?: string | null
  sourceId?: string | null
  success: boolean
  errorMessage?: string | null
  sentAt: Date | null
}

export interface ApplyBackofficeEmailDispatchWebhookRepositoryInput {
  dispatchId: string
  eventId: string
  eventType: BackofficeEmailDispatchEventType
  occurredAt: Date
  metadata?: Prisma.InputJsonValue
  status?: BackofficeEmailDispatchStatus
  timestampUpdate?: Partial<
    Pick<
      BackofficeEmailDispatch,
      "sentAt" | "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt"
    >
  >
}

export interface ProfileRecipientRepositoryRow {
  email: string
  googleEmail: string | null
}

export interface ProfileEmailMatchRepositoryRow {
  id: string
  email: string
  googleEmail: string | null
}

export interface IBackofficeEmailDispatchRepository {
  findProfileRecipientEmails(profileId: string): Promise<ProfileRecipientRepositoryRow | null>
  findProfilesByRecipientEmails(emails: string[]): Promise<ProfileEmailMatchRepositoryRow[]>
  createQueuedDispatch(input: CreateBackofficeEmailDispatchRepositoryInput): Promise<string>
  markSent(id: string, resendEmailId: string, sentAt: Date): Promise<void>
  markFailed(id: string, errorMessage: string): Promise<void>
  recordGoogleDispatch(input: RecordGoogleDispatchRepositoryInput): Promise<string>
  findByResendEmailId(resendEmailId: string): Promise<BackofficeEmailDispatchRecord | null>
  applyWebhookEvent(input: ApplyBackofficeEmailDispatchWebhookRepositoryInput): Promise<void>
}
