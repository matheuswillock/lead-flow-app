import type { Prisma } from "@prisma/client"
import {
  queueProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository"
import type {
  IQueueProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/queueProcessingFailure/IQueueProcessingFailureRepository"

export const DEFAULT_QUEUE_MAX_DELIVERY_COUNT = 20

export type AckAfterMaxDeliveriesInput = {
  deliveryCount: number
  topic: string
  idempotencyKey: string
  payload: unknown
  lastError: unknown
  maxDeliveryCount?: number
}

export type AckAfterMaxDeliveriesFn = (input: AckAfterMaxDeliveriesInput) => Promise<boolean>

export type DeadLetterInvalidPayloadInput = {
  topic: string
  /** `idempotencyKey` do payload; sem ele, o caller passa um derivado do `messageId`. */
  idempotencyKey: string
  payload: unknown
  reason: string
}

export type DeadLetterInvalidPayloadFn = (input: DeadLetterInvalidPayloadInput) => Promise<void>

export function resolveQueueMaxDeliveryCount(
  envValue = process.env.QUEUE_MAX_DELIVERY_COUNT,
): number {
  const parsed = Number(envValue ?? DEFAULT_QUEUE_MAX_DELIVERY_COUNT)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_QUEUE_MAX_DELIVERY_COUNT
  }
  return parsed
}

export function formatQueueProcessingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000)
  }
  return String(error).slice(0, 2000)
}

function toJsonPayload(payload: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue
  } catch {
    return { unserializable: true }
  }
}

/**
 * Quando `deliveryCount >= N` (default 20), persiste no outbox
 * `QueueProcessingFailure` e retorna `true` — o caller MUST ack (não relançar).
 * Abaixo do limite, ou se o persist falhar, retorna `false` para o caller
 * relançar e a Vercel Queue continuar o retry.
 */
export async function ackAfterMaxDeliveries(
  input: AckAfterMaxDeliveriesInput,
  writer: Pick<IQueueProcessingFailureRepository, "upsertFromProcessingFailure"> = queueProcessingFailureRepository,
): Promise<boolean> {
  const maxDeliveryCount = input.maxDeliveryCount ?? resolveQueueMaxDeliveryCount()
  if (input.deliveryCount < maxDeliveryCount) {
    return false
  }

  try {
    await writer.upsertFromProcessingFailure({
      topic: input.topic,
      idempotencyKey: input.idempotencyKey,
      payload: toJsonPayload(input.payload),
      lastError: formatQueueProcessingError(input.lastError),
    })
    return true
  } catch (outboxError) {
    console.error("[ackAfterMaxDeliveries] falha ao gravar no outbox, mantém retry", {
      topic: input.topic,
      idempotencyKey: input.idempotencyKey,
      deliveryCount: input.deliveryCount,
      outboxError,
    })
    return false
  }
}

/**
 * Payload malformado vai direto para a dead-letter, sem passar pelo
 * `deliveryCount` (SPEC 40 E5, todo 11). Retentar não conserta payload sem os
 * campos obrigatórios — o retry só produz ruído; o que faltava era o rastro. O
 * caller acka de qualquer jeito: se nem o outbox aceitar, o erro fica no log em
 * vez de virar mensagem eterna.
 *
 * Grava como **terminal** (`failed`), não `pending` (review #1042): `pending`
 * entra no `RetryQueueProcessingFailuresUseCase`, que republicaria o mesmo
 * payload malformado — o consumer dead-letta outra vez, a linha volta a
 * `pending`, e o ciclo fila↔outbox não fecha nunca.
 */
export async function deadLetterInvalidPayload(
  input: DeadLetterInvalidPayloadInput,
  writer: Pick<
    IQueueProcessingFailureRepository,
    "recordTerminalFailure"
  > = queueProcessingFailureRepository,
): Promise<void> {
  try {
    await writer.recordTerminalFailure({
      topic: input.topic,
      idempotencyKey: input.idempotencyKey,
      payload: toJsonPayload(input.payload),
      lastError: input.reason.slice(0, 2000),
    })
  } catch (outboxError) {
    console.error("[deadLetterInvalidPayload] falha ao gravar no outbox", {
      topic: input.topic,
      idempotencyKey: input.idempotencyKey,
      outboxError,
    })
  }
}
