import { publicFormJourneyRepository } from "@/app/api/infra/data/repositories/publicFormJourney/PublicFormJourneyRepository"
import {
  buildPublicFormMetricQueuePayload,
  publishServerPublicFormMetricEvent,
} from "@/lib/queues/public-form-metric-events"
import {
  MarkAbandonedJourneySessionsUseCase,
  type AbandonmentEventPublisher,
} from "./MarkAbandonedJourneySessionsUseCase"

/**
 * `form_abandoned` é server-side: nasce aqui, nunca em `/events`. O `eventKey`
 * causal (sessão + `lastActivityAt`) serve de chave de idempotência, então uma
 * reentrega do cron não duplica o evento.
 */
const publishAbandonment: AbandonmentEventPublisher = async (input) =>
  publishServerPublicFormMetricEvent(
    buildPublicFormMetricQueuePayload(input.publicId, {
      visitorSessionId: input.visitorSessionId,
      eventType: "form_abandoned",
      eventKey: input.eventKey,
      occurredAt: input.occurredAt.toISOString(),
      origin: { publicationId: input.publicationId },
      createCrmLead: false,
    }),
    "MarkAbandonedJourneySessionsUseCase",
    { idempotencyKey: input.eventKey },
  )

export const markAbandonedJourneySessionsUseCase = new MarkAbandonedJourneySessionsUseCase(
  publicFormJourneyRepository,
  publishAbandonment,
)
