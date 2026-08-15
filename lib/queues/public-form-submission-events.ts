import { QueueClient } from "@vercel/queue"
import type { PublicFormSubmissionBackgroundJob } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"

/**
 * Fila da submissão de formulário público (PR2.3 — after() só publica, sem
 * lead match/agendamento no isolate do POST /submissions). O processamento
 * de negócio continua em PublicFormSubmissionUseCase.processInBackground(),
 * só quem invoca muda. Região fixa em `gru1` para alinhar com `vercel.json`.
 */
export const PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC = "public-form-submission-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const PUBLIC_FORM_SUBMISSION_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

const queue = new QueueClient({ region: "gru1" })

export async function publishPublicFormSubmissionEvent(
  payload: PublicFormSubmissionBackgroundJob,
): Promise<{ messageId: string | null }> {
  return queue.send(PUBLIC_FORM_SUBMISSION_EVENTS_TOPIC, payload, {
    idempotencyKey: payload.requestKey,
    retentionSeconds: PUBLIC_FORM_SUBMISSION_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handlePublicFormSubmissionEventsCallback } = queue
