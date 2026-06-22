import type { BackofficeEmailDispatchEventType } from "@prisma/client"
import { Output } from "@/lib/output"
import { emailLogRepository } from "@/app/api/infra/data/repositories/emailLog/EmailLogRepository"
import { backofficeEmailDispatchUseCase } from "@/app/api/useCases/backofficeEmailDispatch/BackofficeEmailDispatchUseCase"
import {
  resendEmailEnrichmentService,
  type ResendEmailEnrichmentService,
} from "@/app/api/services/resend/ResendEmailEnrichmentService"
import {
  resendWebhookService,
  type ResendWebhookService,
} from "@/app/api/services/resend/ResendWebhookService"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

export type HandleResendWebhookInput = {
  event: ResendWebhookPayload
  svixId?: string | null
}

export class ResendWebhookUseCase {
  constructor(
    private readonly webhookService: ResendWebhookService = resendWebhookService,
    private readonly enrichmentService: ResendEmailEnrichmentService = resendEmailEnrichmentService
  ) {}

  async handle(input: HandleResendWebhookInput): Promise<Output> {
    const { event, svixId } = input
    const resendEmailId = event.data?.email_id
    const eventType = this.webhookService.mapEventType(event.type)
    const backofficeEventType =
      event.type === "email.suppressed"
        ? ("suppressed" as BackofficeEmailDispatchEventType)
        : eventType

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
    }

    if (eventType) {
      let log = await emailLogRepository.findByResendEmailId(resendEmailId)

      if (!log && event.type === "email.sent") {
        await this.enrichmentService.createOrphanTeamEmailLogFromResendEmail(
          resendEmailId,
          occurredAt
        )
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

    if (!eventType && !backofficeEventType) {
      console.info("[ResendWebhookUseCase] Evento ignorado:", event.type)
      return new Output(true, [], [], { handled: false, reason: "unsupported_event" })
    }

    console.info("[ResendWebhookUseCase] Registro não encontrado para resendEmailId:", resendEmailId)
    return new Output(true, [], [], { handled: false, reason: "not_found" })
  }
}

export const resendWebhookUseCase = new ResendWebhookUseCase()
