import type { EmailEventType } from "@prisma/client"
import { randomUUID } from "crypto"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import type { IEmailLogRepository, EmailLogWebhookRecord } from "@/app/api/infra/data/repositories/emailLog/IEmailLogRepository"

const EVENT_TYPE_MAP: Record<string, EmailEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
  "email.delivery_delayed": "delivery_delayed",
  "email.unsubscribed": "unsubscribed",
  "email.failed": "failed",
}

export class ResendWebhookService {
  constructor(private readonly emailLogs: IEmailLogRepository = emailLogRepository) {}

  mapEventType(resendEventType: string): EmailEventType | null {
    return EVENT_TYPE_MAP[resendEventType] ?? null
  }

  async processEmailLogWebhook(input: {
    log: EmailLogWebhookRecord
    eventType: EmailEventType
    occurredAt: Date
    metadata: Record<string, unknown>
    resendEventType: string
    svixId?: string | null
  }): Promise<boolean> {
    const { log, eventType, occurredAt, metadata } = input
    const eventMetadata = {
      ...metadata,
      ...(input.svixId ? { svixId: input.svixId } : {}),
    }

    const duplicate = await this.emailLogs.hasDuplicateEvent(log.id, eventType, occurredAt)
    if (duplicate) {
      console.info(
        `[ResendWebhookService] Evento duplicado ignorado para log ${log.id}: ${input.resendEventType}`
      )
      return true
    }

    await this.emailLogs.applyWebhookEvent({
      log,
      eventType,
      occurredAt,
      metadata: eventMetadata,
      eventId: randomUUID(),
    })

    console.info(`[ResendWebhookService] Evento ${input.resendEventType} processado para log ${log.id}`)
    return true
  }
}

export const resendWebhookService = new ResendWebhookService()
