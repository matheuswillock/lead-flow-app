import type {
  BackofficeEmailDispatchCategory,
  BackofficeEmailDispatchEventType,
  BackofficeEmailDispatchProvider,
  BackofficeEmailDispatchStatus,
  BackofficeEmailRecipientKind,
} from "@prisma/client"

export interface CreateBackofficeEmailDispatchInput {
  profileId: string
  recipientEmail: string
  recipientKind: BackofficeEmailRecipientKind
  provider: BackofficeEmailDispatchProvider
  category: BackofficeEmailDispatchCategory
  subject: string
  sourceType?: string | null
  sourceId?: string | null
}

export interface RecordGoogleDispatchInput extends CreateBackofficeEmailDispatchInput {
  success: boolean
  errorMessage?: string | null
}

export interface ApplyResendWebhookEventInput {
  resendEmailId: string
  eventType: BackofficeEmailDispatchEventType
  occurredAt: Date
  metadata?: Record<string, unknown>
}

export interface ProfileRecipientResolved {
  email: string
  kind: "account" | "google"
}

export interface ProfileEmailMatch {
  profileId: string
  email: string
  kind: BackofficeEmailRecipientKind
}

export interface IBackofficeEmailDispatchService {
  resolveProfileRecipients(profileId: string): Promise<ProfileRecipientResolved[]>
  resolveProfilesByRecipientEmails(emails: string[]): Promise<ProfileEmailMatch[]>
  createQueuedDispatch(input: CreateBackofficeEmailDispatchInput): Promise<string>
  markSent(id: string, resendEmailId: string): Promise<void>
  markFailed(id: string, errorMessage: string): Promise<void>
  recordGoogleDispatch(input: RecordGoogleDispatchInput): Promise<string>
  applyResendWebhookEvent(input: ApplyResendWebhookEventInput): Promise<boolean>
  getStatusPriority(status: BackofficeEmailDispatchStatus): number
  mapResendEventType(eventType: string): BackofficeEmailDispatchEventType | null
}
