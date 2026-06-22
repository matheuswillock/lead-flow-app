import { randomUUID } from "crypto"
import type {
  BackofficeEmailDispatchEventType,
  BackofficeEmailDispatchStatus,
  Prisma,
} from "@prisma/client"
import { resolveProfileRecipientEmails } from "@/lib/email/resolve-profile-recipient-emails"
import { backofficeEmailDispatchRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeEmailDispatch/BackofficeEmailDispatchRepository"
import type { IBackofficeEmailDispatchRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeEmailDispatch/IBackofficeEmailDispatchRepository"
import type {
  ApplyResendWebhookEventInput,
  CreateBackofficeEmailDispatchInput,
  IBackofficeEmailDispatchService,
  ProfileRecipientResolved,
  RecordGoogleDispatchInput,
  ProfileEmailMatch,
} from "./IBackofficeEmailDispatchService"

const RESEND_EVENT_TYPE_MAP: Record<string, BackofficeEmailDispatchEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delivery_delayed",
  "email.unsubscribed": "unsubscribed",
  "email.suppressed": "suppressed",
}

const DISPATCH_STATUS_EVENT_TYPES = new Set<BackofficeEmailDispatchStatus>([
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "failed",
  "delivery_delayed",
  "suppressed",
])

const STATUS_PRIORITY: BackofficeEmailDispatchStatus[] = [
  "suppressed",
  "complained",
  "bounced",
  "failed",
  "clicked",
  "opened",
  "delivered",
  "delivery_delayed",
  "sent",
  "queued",
]

const TIMESTAMP_FIELD: Partial<
  Record<BackofficeEmailDispatchEventType, "sentAt" | "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt">
> = {
  sent: "sentAt",
  delivered: "deliveredAt",
  opened: "openedAt",
  clicked: "clickedAt",
  bounced: "bouncedAt",
  complained: "complainedAt",
}

export class BackofficeEmailDispatchService implements IBackofficeEmailDispatchService {
  constructor(private readonly repository: IBackofficeEmailDispatchRepository) {}

  async resolveProfileRecipients(profileId: string): Promise<ProfileRecipientResolved[]> {
    const profile = await this.repository.findProfileRecipientEmails(profileId)
    if (!profile) return []

    return resolveProfileRecipientEmails({
      accountEmail: profile.email,
      googleEmail: profile.googleEmail,
    })
  }

  async resolveProfilesByRecipientEmails(emails: string[]): Promise<ProfileEmailMatch[]> {
    const normalized = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))]
    if (normalized.length === 0) return []

    const profiles = await this.repository.findProfilesByRecipientEmails(normalized)
    const matches: ProfileEmailMatch[] = []

    for (const email of normalized) {
      for (const profile of profiles) {
        const accountEmail = profile.email.trim().toLowerCase()
        const googleEmail = profile.googleEmail?.trim().toLowerCase() ?? null

        if (accountEmail === email) {
          matches.push({ profileId: profile.id, email, kind: "account" })
        } else if (googleEmail === email) {
          matches.push({ profileId: profile.id, email, kind: "google" })
        }
      }
    }

    return matches
  }

  async createQueuedDispatch(input: CreateBackofficeEmailDispatchInput): Promise<string> {
    return this.repository.createQueuedDispatch({
      id: randomUUID(),
      profileId: input.profileId,
      recipientEmail: input.recipientEmail,
      recipientKind: input.recipientKind,
      provider: input.provider,
      category: input.category,
      subject: input.subject,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    })
  }

  async markSent(id: string, resendEmailId: string): Promise<void> {
    await this.repository.markSent(id, resendEmailId, new Date())
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.repository.markFailed(id, errorMessage)
  }

  async recordGoogleDispatch(input: RecordGoogleDispatchInput): Promise<string> {
    const now = new Date()
    return this.repository.recordGoogleDispatch({
      id: randomUUID(),
      profileId: input.profileId,
      recipientEmail: input.recipientEmail,
      recipientKind: input.recipientKind,
      category: input.category,
      subject: input.subject,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      success: input.success,
      errorMessage: input.errorMessage,
      sentAt: input.success ? now : null,
    })
  }

  getStatusPriority(status: BackofficeEmailDispatchStatus): number {
    const index = STATUS_PRIORITY.indexOf(status)
    return index === -1 ? STATUS_PRIORITY.length : index
  }

  mapResendEventType(eventType: string): BackofficeEmailDispatchEventType | null {
    return RESEND_EVENT_TYPE_MAP[eventType] ?? null
  }

  async applyResendWebhookEvent(input: ApplyResendWebhookEventInput): Promise<boolean> {
    const dispatch = await this.repository.findByResendEmailId(input.resendEmailId)
    if (!dispatch) return false

    const eventType = input.eventType
    const timestampField = TIMESTAMP_FIELD[eventType]
    const timestampUpdate = timestampField ? { [timestampField]: input.occurredAt } : {}

    const currentPriority = this.getStatusPriority(dispatch.status)
    const mappedStatus = DISPATCH_STATUS_EVENT_TYPES.has(eventType as BackofficeEmailDispatchStatus)
      ? (eventType as BackofficeEmailDispatchStatus)
      : null
    const newPriority = mappedStatus ? this.getStatusPriority(mappedStatus) : STATUS_PRIORITY.length
    const shouldUpdateStatus = mappedStatus !== null && newPriority < currentPriority

    await this.repository.applyWebhookEvent({
      dispatchId: dispatch.id,
      eventId: randomUUID(),
      eventType,
      occurredAt: input.occurredAt,
      metadata:
        input.metadata && Object.keys(input.metadata).length > 0
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined,
      status: shouldUpdateStatus && mappedStatus ? mappedStatus : undefined,
      timestampUpdate,
    })

    return true
  }
}

export const backofficeEmailDispatchService = new BackofficeEmailDispatchService(
  backofficeEmailDispatchRepository
)
