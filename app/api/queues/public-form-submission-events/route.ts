import {
  publicFormSubmissionUseCase,
  PublicFormSubmissionUseCase,
  type PublicFormSubmissionBackgroundJob,
} from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import { handlePublicFormSubmissionEventsCallback } from "@/lib/queues/public-form-submission-events"

type QueueMessageMetadata = {
  messageId: string
  deliveryCount: number
  topicName?: string
  consumerGroup?: string
  region?: string
}

/**
 * Consumer push privado (trigger `queue/v2beta`, maxConcurrency configurado
 * em vercel.json). Processa o job de submissão completo (lead match +
 * agendamento) fora do isolate HTTP do POST /submissions — o `after()`
 * dessa rota agora só publica nesta fila (PR2.3).
 */
export async function processPublicFormSubmissionEventMessage(
  message: PublicFormSubmissionBackgroundJob,
  metadata: QueueMessageMetadata,
  useCase: Pick<PublicFormSubmissionUseCase, "processInBackground"> = publicFormSubmissionUseCase,
): Promise<void> {
  console.info("[PublicFormSubmissionEventsQueueRoute][POST] message received", {
    messageId: metadata.messageId,
    deliveryCount: metadata.deliveryCount,
    topicName: metadata.topicName,
    consumerGroup: metadata.consumerGroup,
    region: metadata.region,
    submissionId: message?.submissionId,
    requestKey: message?.requestKey,
  })

  if (!message?.submissionId || !message?.requestKey || !message?.snapshot) {
    console.error("[PublicFormSubmissionEventsQueueRoute][POST] invalid payload, acking", {
      messageId: metadata.messageId,
      message,
    })
    return
  }

  try {
    await useCase.processInBackground(message)
    console.info("[PublicFormSubmissionEventsQueueRoute][POST] submission processed", {
      messageId: metadata.messageId,
      submissionId: message.submissionId,
      requestKey: message.requestKey,
    })
  } catch (error) {
    console.error("[PublicFormSubmissionEventsQueueRoute][POST] processInBackground failed, will retry", {
      messageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      submissionId: message.submissionId,
      requestKey: message.requestKey,
      error,
    })
    throw error
  }
}

export const POST = handlePublicFormSubmissionEventsCallback(
  (message: PublicFormSubmissionBackgroundJob, metadata: QueueMessageMetadata) =>
    processPublicFormSubmissionEventMessage(message, metadata),
  {
    retry: (_error: unknown, metadata: QueueMessageMetadata) => ({
      afterSeconds: Math.min(60 * Math.max(1, metadata.deliveryCount), 300),
    }),
  },
)
