import type { Prisma } from "@prisma/client"
import { publicFormsUseCase, PublicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import type { PublicFormMetricEventInput } from "@/lib/public-forms/types"
import {
  handlePublicFormMetricEventsCallback,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events"
import {
  formatProcessingError,
  publicFormQueueEventFailureRepository,
} from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/PublicFormQueueEventFailureRepository"
import type { IPublicFormQueueEventFailureRepository } from "@/app/api/infra/data/repositories/publicFormQueueEventFailure/IPublicFormQueueEventFailureRepository"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Tópicos na Vercel Queues são particionados por deployment: uma mensagem é
 * sempre reentregue para o MESMO deployment que a publicou (push mode), nunca
 * para um deployment mais novo. Se essa mensagem começou a falhar num
 * deployment antigo (com bug já corrigido em produção), nenhum fix de código
 * a resgata — ela reentrega para sempre contra o deployment antigo até
 * expirar (retentionSeconds, até 7 dias). Acima de `MAX_DELIVERY_COUNT`,
 * desviamos para o outbox `PublicFormQueueEventFailure` (kind=metric) e
 * acknowledgeamos a mensagem: o cron de retry (`RetryPublicFormQueueEventFailuresUseCase`)
 * republica como mensagem NOVA, que passa a ser processada pelo deployment
 * atual (com todos os fixes).
 */
const MAX_DELIVERY_COUNT = Math.max(
  1,
  Number(process.env.PUBLIC_FORM_METRIC_EVENTS_MAX_DELIVERY_COUNT ?? 20),
)

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency: 1).
 * Persiste `PublicFormMetricEvent` de forma idempotente via `eventKey` único.
 * Entrega at-least-once: duplicatas colapsam no upsert do repositório.
 */
export async function processPublicFormMetricQueueMessage(
  message: PublicFormMetricQueuePayload,
  metadata: QueueMessageMetadata,
  useCase: Pick<PublicFormsUseCase, "persistQueuedMetric"> = publicFormsUseCase,
  outboxRepository: Pick<
    IPublicFormQueueEventFailureRepository,
    "upsertFromProcessingFailure"
  > = publicFormQueueEventFailureRepository,
): Promise<void> {
  console.info("[PublicFormMetricEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    eventType: message?.eventType,
    eventKey: message?.eventKey,
    publicId: message?.publicId,
  })

  if (!message?.publicId || !message?.eventKey || !message?.visitorSessionId || !message?.eventType) {
    console.error("[PublicFormMetricEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  const input: PublicFormMetricEventInput = {
    visitorSessionId: message.visitorSessionId,
    eventType: message.eventType as PublicFormMetricEventInput["eventType"],
    questionId: message.questionId ?? undefined,
    eventKey: message.eventKey,
    origin: message.origin ?? {},
  }

  try {
    const accepted = await useCase.persistQueuedMetric(message.publicId, input)
    if (!accepted) {
      // Formulário indisponível / publicação encerrada — sem sentido retry infinito.
      console.info("[PublicFormMetricEventsQueueRoute][POST] form unavailable, acking", {
        messageId: metadata.messageId,
        publicId: message.publicId,
        eventKey: message.eventKey,
      })
      return
    }
    console.info("[PublicFormMetricEventsQueueRoute][POST] metric persisted", {
      messageId: metadata.messageId,
      eventKey: message.eventKey,
      eventType: message.eventType,
      visitorSessionId: message.visitorSessionId,
      questionId: message.questionId ?? null,
      value: (message.origin as Record<string, unknown> | undefined)?.answerValue ?? null,
    })
  } catch (error) {
    console.error("[PublicFormMetricEventsQueueRoute][POST] persist failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      eventKey: message.eventKey,
      error,
    })

    if (metadata.deliveryCount >= MAX_DELIVERY_COUNT) {
      try {
        await outboxRepository.upsertFromProcessingFailure({
          kind: "metric",
          idempotencyKey: message.eventKey,
          payload: message as unknown as Prisma.InputJsonValue,
          lastError: formatProcessingError(error),
          failureReason: "delivery_count_exceeded",
        })
        console.error(
          "[PublicFormMetricEventsQueueRoute][POST] deliveryCount excedeu o limite, movido para outbox, acking",
          {
            messageId: metadata.messageId,
            deliveryCount: metadata.deliveryCount,
            eventKey: message.eventKey,
          },
        )
        return
      } catch (outboxError) {
        console.error(
          "[PublicFormMetricEventsQueueRoute][POST] falha ao gravar no outbox, mantém retry",
          {
            messageId: metadata.messageId,
            eventKey: message.eventKey,
            outboxError,
          },
        )
      }
    }

    throw error
  }
}

export const POST = handlePublicFormMetricEventsCallback(
  processPublicFormMetricQueueMessage,
  {
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  },
)
