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
import {
  classifyEmailEventOrigin,
  type EmailEventOrigin,
} from "@/lib/email/email-event-origin-classifier"
import { emailCampaignAudiencePruneUseCase } from "@/app/api/useCases/email/EmailCampaignAudiencePruneUseCase"
import type { ResendWebhookPayload } from "@/app/api/useCases/resendWebhook/resendWebhookTypes"

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

  /**
   * Origem de `opened`/`clicked` a partir dos sinais crus do payload. Os
   * demais tipos não têm origem — devolve `undefined`.
   *
   * `deliveredAt` é opcional de propósito: no caminho órfão o `EmailLog` ainda
   * não existe e a janela de pré-fetch não pode ser avaliada aqui; ela é
   * reaplicada no dreno (`reinforceOriginWithDeliveryDelta`).
   */
  private classifyEventOrigin(input: {
    event: ResendWebhookPayload
    eventType: EmailEventType
    occurredAt: Date
    deliveredAt: Date | null
  }): EmailEventOrigin | undefined {
    const { event, eventType, occurredAt, deliveredAt } = input
    if (eventType !== "opened" && eventType !== "clicked") return undefined

    const rawSignals = eventType === "opened" ? event.data.open : event.data.click
    return classifyEmailEventOrigin({
      userAgent: rawSignals?.userAgent ?? null,
      ipAddress: rawSignals?.ipAddress ?? null,
      occurredAt,
      deliveredAt,
    })
  }

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

    // Abertura/clique usam o timestamp REAL do evento (open/click.timestamp).
    // Com `data.created_at` (hora de criação do e-mail, constante por
    // mensagem), toda repetição de open colidia no dedupe por
    // (logId, type, occurredAt) e sumia — ver ResendWebhookService.resolveOccurredAt.
    const occurredAt = this.webhookService.resolveOccurredAt(event)

    const metadata: Record<string, unknown> = {}
    if (event.data.click) {
      metadata.link = event.data.click.link
      metadata.userAgent = event.data.click.userAgent
      // `ipAddress` NÃO é persistido (LGPD): o IP entra só no classificador de
      // origem, em memória, e vira `metadata.origin` — nunca o valor cru.
    }
    if (event.data.bounce) {
      metadata.bounceMessage = event.data.bounce.message
      if (event.data.bounce.type) {
        metadata.bounceType = event.data.bounce.type
      }
      if (event.data.bounce.subType) {
        metadata.bounceSubType = event.data.bounce.subType
      }
      if (event.data.bounce.diagnosticCode && event.data.bounce.diagnosticCode.length > 0) {
        metadata.bounceDiagnosticCode = event.data.bounce.diagnosticCode
      }
    }

    if (eventType) {
      let log = await emailLogRepository.findByResendEmailId(resendEmailId)

      // Sem whitelist de tipo: a antiga excluía justamente os eventos de
      // conformidade (complained/unsubscribed/delivery_delayed/failed), que
      // sumiam sem rastro quando o EmailLog ainda não existia. O `eventType`
      // já garante que só entra tipo que o dreno sabe aplicar.
      if (!log) {
        const tagsHint = event.data.tags
        if (!isBackofficeResendTags(tagsHint ?? null)) {
          await emailOrphanEventService.queueOrphanEvent({
            resendEmailId,
            resendEventType: event.type,
            occurredAt,
            tagsHint,
            // Os sinais crus de origem só existem NESTE payload: o dreno roda
            // minutos depois, sem user-agent nem IP. Sem o carimbo aqui, todo
            // open/clique recuperado voltaria sem origem e ficaria fora de
            // `humanOpenedAt` e dos segmentos humanos do Radar. A janela de
            // pré-fetch é reavaliada no dreno, quando a entrega é conhecida.
            originHint: this.classifyEventOrigin({ event, eventType, occurredAt, deliveredAt: null }),
          })
        }
        log = await emailLogRepository.findByResendEmailId(resendEmailId)
      }

      if (log) {
        // Classifica a origem de opened/clicked ANTES de persistir: proxies do
        // provedor (Gmail image proxy, Apple MPP) e scanners não contam como
        // engajamento humano. Decisão do owner (17/09): origem não-humana NÃO
        // conta nas métricas de "Aberturas reais".
        const origin = this.classifyEventOrigin({
          event,
          eventType,
          occurredAt,
          deliveredAt: log.deliveredAt,
        })
        if (origin) metadata.origin = origin

        await this.webhookService.processEmailLogWebhook({
          log,
          eventType,
          occurredAt,
          metadata,
          resendEventType: event.type,
          svixId,
          origin,
        })

        if (eventType === "bounced") {
          emailCampaignAudiencePruneUseCase.queuePruneForSuppressedEmail(log.recipientEmail)
        } else if (eventType === "complained") {
          emailCampaignAudiencePruneUseCase.queuePruneForComplaint(log.recipientEmail)
        }

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
