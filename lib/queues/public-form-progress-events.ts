import { createHash } from "node:crypto"
import { QueueClient } from "@vercel/queue"
import type { PublicFormAnswerInput } from "@/lib/public-forms/types"

/**
 * Fila do blur/progresso de formulário público. O POST /progress só publica;
 * o persist (Prisma + lead sync) roda no consumer. Região fixa em `gru1`
 * para alinhar com `vercel.json`.
 */
export const PUBLIC_FORM_PROGRESS_EVENTS_TOPIC = "public-form-progress-events"

/** Retenção máxima documentada pela Vercel Queues (7 dias). */
export const PUBLIC_FORM_PROGRESS_EVENTS_RETENTION_SECONDS = 60 * 60 * 24 * 7

const queue = new QueueClient({ region: "gru1" })

export type PublicFormProgressQueuePayload = {
  publicId: string
  schemaVersion: 1
  eventId: string
  occurredAt: string
  trigger: "blur" | "change" | "page_flush" | "submit_reconciliation"
  visitorSessionId: string
  answers: PublicFormAnswerInput[]
  origin: Record<string, unknown>
  lastQuestionId?: string
  idempotencyKey: string
}

function canonicalizeProgressValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim()
  return value
}

export function hashPublicFormProgressValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeProgressValue(value)))
    .digest("hex")
    .slice(0, 16)
}

/**
 * D1: a chave inclui o hash do valor. Blur vazio e blur preenchido não
 * compartilham idempotencyKey — senão a Vercel Queue descarta o valor útil.
 */
export function buildPublicFormProgressIdempotencyKey(input: {
  visitorSessionId: string
  publicId: string
  answers: PublicFormAnswerInput[]
  lastQuestionId?: string
}): string {
  const answer =
    (input.lastQuestionId
      ? input.answers.find((item) => item.questionId === input.lastQuestionId)
      : undefined) ?? input.answers[0]

  if (!answer) {
    return `progress:${input.visitorSessionId}:${input.publicId}:none:${hashPublicFormProgressValue(null)}`
  }

  const valueHash =
    input.answers.length === 1
      ? hashPublicFormProgressValue(answer.value)
      : hashPublicFormProgressValue(
          input.answers.map((item) => [item.questionId, canonicalizeProgressValue(item.value)]),
        )

  return `progress:${input.visitorSessionId}:${input.publicId}:${answer.questionId}:${valueHash}`
}

export function buildPublicFormProgressQueuePayload(input: {
  publicId: string
  visitorSessionId: string
  answers: PublicFormAnswerInput[]
  origin: Record<string, unknown>
  lastQuestionId?: string
  schemaVersion?: 1
  eventId?: string
  occurredAt?: string
  trigger?: "blur" | "change" | "page_flush" | "submit_reconciliation"
}): PublicFormProgressQueuePayload {
  const fallbackIdempotencyKey = buildPublicFormProgressIdempotencyKey(input)
  const eventId = input.eventId ?? crypto.randomUUID()
  return {
    publicId: input.publicId,
    schemaVersion: input.schemaVersion ?? 1,
    eventId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    trigger: input.trigger ?? "blur",
    visitorSessionId: input.visitorSessionId,
    answers: input.answers,
    origin: input.origin,
    lastQuestionId: input.lastQuestionId,
    idempotencyKey: input.eventId ?? fallbackIdempotencyKey,
  }
}

export async function publishPublicFormProgressEvent(
  payload: PublicFormProgressQueuePayload,
  options?: { idempotencyKey?: string },
): Promise<{ messageId: string | null }> {
  return queue.send(PUBLIC_FORM_PROGRESS_EVENTS_TOPIC, payload, {
    idempotencyKey: options?.idempotencyKey ?? payload.idempotencyKey,
    retentionSeconds: PUBLIC_FORM_PROGRESS_EVENTS_RETENTION_SECONDS,
  })
}

export const { handleCallback: handlePublicFormProgressEventsCallback } = queue
