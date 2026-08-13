import type { BackofficeEmailDispatchEventType, EmailEventType } from "@prisma/client"
import { Output } from "@/lib/output"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { backofficeEmailDispatchUseCase } from "@/app/api/useCases/backofficeEmailDispatch/BackofficeEmailDispatchUseCase"
import { backofficeEmailCampaignUseCase } from "@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase"
import { emailOrphanEventService } from "@/app/api/services/resend/EmailOrphanEventService"
import { isBackofficeResendTags } from "@/lib/email/build-backoffice-resend-tags"
import {
  resendWebhookService,
  type ResendWebhookService,
} from "@/app/api/services/resend/ResendWebhookService"
import {
  radarService,
} from "@/app/api/services/radar/RadarService"
import type { ResendWebhookRadarEventPayload } from "@/lib/queues/resend-webhook-radar-events"
import {
  resendDomainWebhookUseCase,
} from "@/app/api/useCases/resendWebhook/ResendDomainWebhookUseCase"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

const ORPHAN_BACKFILL_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.suppressed",
])

const RESEND_WEBHOOK_RADAR_QUEUE_PUBLISH_FAILED_TAG =
  "resend_webhook_radar_queue_publish_failed"

async function defaultPublishRadarEvent(
  payload: ResendWebhookRadarEventPayload
): Promise<{ messageId: string | null }> {
  const { publishResendWebhookRadarEvent } = await import(
    "@/lib/queues/resend-webhook-radar-events"
  )
  return publishResendWebhookRadarEvent(payload)
}

export type HandleResendWebhookInput = {
  event: ResendWebhookPayload
  svixId?: string | null
}

export class ResendWebhookUseCase {
  constructor(
    private readonly webhookService: ResendWebhookService = resendWebhookService,
    private readonly publishRadarEvent: (
      payload: ResendWebhookRadarEventPayload
    ) => Promise<{ messageId: string | null }> = defaultPublishRadarEvent
  ) {}

  async handle(input: HandleResendWebhookInput): Promise<Output> {
    const { event, svixId } = input

    if (event.type.startsWith("domain.")) {
      return resendDomainWebhookUseCase.handle(event)
    }

    const resendEmailId = event.data?.email_id
    const eventType = this.webhookService.mapEventType(event.type)
    const backofficeEventType = eventType as unknown as BackofficeEmailDispatchEventType | null

    if (!resendEmailId) {
      console.info("[ResendWebhookUseCase] Evento ignorado:", event.type)
      return new Output(true, [], [], { handled: false, reason: "missing_email_id" })
    }

    const occurredAt = event.data.created_at ? new Date(event.data.created_at) : new Date()

    const metadata: Record<string, unknown> = {}
    if (event.data.click) {
      metadata.link = event.data.click.link
      metadata.userAgent = event.data.click.userAgent
      metadata.ipAddress = event.data.click.ipAddress
    }
    if (event.data.bounce) {
      metadata.bounceMessage = event.data.bounce.message
      if (event.data.bounce.type) {
        metadata.bounceType = event.data.bounce.type
      }
    }

    if (eventType) {
      let log = await emailLogRepository.findByResendEmailId(resendEmailId)

      if (!log) {
        log = await emailLogRepository.findByResendEmailId(resendEmailId)
      }

      if (!log && ORPHAN_BACKFILL_EVENTS.has(event.type)) {
        const tagsHint = event.data.tags
        if (!isBackofficeResendTags(tagsHint ?? null)) {
          await emailOrphanEventService.queueOrphanEvent({
            resendEmailId,
            resendEventType: event.type,
            occurredAt,
            tagsHint,
          })
        }
        log = await emailLogRepository.findByResendEmailId(resendEmailId)
      }

      if (log) {
        await this.webhookService.processEmailLogWebhook({
          log,
          eventType,
          occurredAt,
          metadata,
          resendEventType: event.type,
          svixId,
        })

        // Radar/engagement fora do isolate do webhook: fila própria (P2024 sob rajada).
        const radarPayload = {
          teamId: log.teamId,
          recipientEmail: log.recipientEmail,
          recipientName: log.recipientName,
          logId: log.id,
          campaignId: log.campaignId,
          eventType,
          occurredAt: occurredAt.toISOString(),
          metadata,
          svixId: svixId ?? null,
        }
        void this.publishRadarEvent(radarPayload).catch((publishError) => {
          console.error(
            `[ResendWebhookUseCase][radar] ${RESEND_WEBHOOK_RADAR_QUEUE_PUBLISH_FAILED_TAG}`,
            publishError
          )
          void radarService
            .handleEmailWebhookEvent({
              teamId: radarPayload.teamId,
              recipientEmail: radarPayload.recipientEmail,
              recipientName: radarPayload.recipientName,
              logId: radarPayload.logId,
              campaignId: radarPayload.campaignId,
              eventType: radarPayload.eventType,
              occurredAt,
              metadata: radarPayload.metadata,
            })
            .catch((radarError) => {
              console.error("[ResendWebhookUseCase][radar]", radarError)
            })
        })

        return new Output(true, ["Evento de email processado"], [], { handled: true, target: "email_log" })
      }
    }

    if (backofficeEventType) {
      const result = await backofficeEmailDispatchUseCase.applyResendWebhookEvent({
        resendEmailId,
        eventType: backofficeEventType,
        occurredAt,
        metadata: {
          ...metadata,
          ...(svixId ? { svixId } : {}),
        },
      })

      if (
        result.isValid &&
        result.result &&
        typeof result.result === "object" &&
        "handled" in result.result &&
        result.result.handled
      ) {
        console.info(
          `[ResendWebhookUseCase] Evento ${event.type} processado para dispatch ${resendEmailId}`
        )
        return new Output(true, ["Evento de dispatch processado"], [], {
          handled: true,
          target: "backoffice_dispatch",
        })
      }
    }

    if (eventType) {
      const campaignResult = await backofficeEmailCampaignUseCase.applyResendWebhookEvent({
        resendEmailId,
        eventType,
        occurredAt,
        metadata: {
          ...metadata,
          ...(svixId ? { svixId } : {}),
        },
      })

      if (campaignResult.result.handled) {
        console.info(
          `[ResendWebhookUseCase] Evento ${event.type} processado para campanha (log ${resendEmailId})`
        )
        return new Output(true, ["Evento de campanha processado"], [], {
          handled: true,
          target: "backoffice_email_campaign",
        })
      }
    }

    if (!eventType && !backofficeEventType) {
      console.info("[ResendWebhookUseCase] Evento ignorado:", event.type)
      return new Output(true, [], [], { handled: false, reason: "unsupported_event" })
    }

    console.info("[ResendWebhookUseCase] Registro não encontrado para resendEmailId:", resendEmailId)
    return new Output(true, [], [], { handled: false, reason: "not_found" })
  }

  async handleRadarQueueEvent(input: {
    teamId: string
    recipientEmail: string
    recipientName?: string | null
    logId: string
    campaignId?: string | null
    eventType: EmailEventType
    occurredAt: Date
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await radarService.handleEmailWebhookEvent(input)
  }
}

export const resendWebhookUseCase = new ResendWebhookUseCase()
