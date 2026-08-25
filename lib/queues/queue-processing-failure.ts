import type { Prisma } from "@prisma/client"
import {
  queueProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/queueProcessingFailure/QueueProcessingFailureRepository"
import type {
  IQueueProcessingFailureRepository,
} from "@/app/api/infra/data/repositories/queueProcessingFailure/IQueueProcessingFailureRepository"

export const DEFAULT_QUEUE_MAX_DELIVERY_COUNT = 20

/**
 * Teto absoluto de entregas. Acima dele o consumer acka **mesmo sem conseguir
 * gravar no outbox**: perder um payload que foi logado é melhor que reter
 * veneno por dias na fila (o caso de 22/08, em que a própria escrita do outbox
 * falhava porque a Vercel Queue reentrega ao deployment quebrado que publicou).
 */
export const DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT = 100

/** Tag única e alertável para a falha final de escrita no outbox. */
export const DEAD_LETTER_WRITE_FAILED_TAG = "dead_letter_write_failed"

/** Tentativas da escrita no outbox antes de considerá-la perdida. */
export const OUTBOX_WRITE_MAX_ATTEMPTS = 3

/** Espera entre as tentativas de escrita — só há espera entre tentativas. */
const OUTBOX_WRITE_RETRY_DELAYS_MS = [200, 500] as const

export type AckAfterMaxDeliveriesInput = {
  deliveryCount: number
  topic: string
  idempotencyKey: string
  payload: unknown
  lastError: unknown
  maxDeliveryCount?: number
  hardMaxDeliveryCount?: number
}

export type AckAfterMaxDeliveriesOptions = {
  sleep?: (ms: number) => Promise<void>
  logError?: (message: string, context: Record<string, unknown>) => void
}

export type AckAfterMaxDeliveriesFn = (input: AckAfterMaxDeliveriesInput) => Promise<boolean>

export function resolveQueueMaxDeliveryCount(
  envValue = process.env.QUEUE_MAX_DELIVERY_COUNT,
): number {
  const parsed = Number(envValue ?? DEFAULT_QUEUE_MAX_DELIVERY_COUNT)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_QUEUE_MAX_DELIVERY_COUNT
  }
  return parsed
}

export function resolveQueueHardMaxDeliveryCount(
  envValue = process.env.QUEUE_HARD_MAX_DELIVERY_COUNT,
  maxDeliveryCount = resolveQueueMaxDeliveryCount(),
): number {
  const parsed = Number(envValue ?? DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT)
  const hardMax = !Number.isFinite(parsed) || parsed < 1
    ? DEFAULT_QUEUE_HARD_MAX_DELIVERY_COUNT
    : parsed
  return Math.max(hardMax, maxDeliveryCount)
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

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

async function writeToOutboxWithRetry(
  input: AckAfterMaxDeliveriesInput,
  writer: Pick<IQueueProcessingFailureRepository, "upsertFromProcessingFailure">,
  sleep: (ms: number) => Promise<void>,
): Promise<unknown | null> {
  let lastOutboxError: unknown = null

  for (let attempt = 1; attempt <= OUTBOX_WRITE_MAX_ATTEMPTS; attempt += 1) {
    try {
      await writer.upsertFromProcessingFailure({
        topic: input.topic,
        idempotencyKey: input.idempotencyKey,
        payload: toJsonPayload(input.payload),
        lastError: formatQueueProcessingError(input.lastError),
      })
      return null
    } catch (outboxError) {
      lastOutboxError = outboxError
      const delayMs = OUTBOX_WRITE_RETRY_DELAYS_MS[attempt - 1]
      if (delayMs !== undefined) {
        await sleep(delayMs)
      }
    }
  }

  return lastOutboxError ?? new Error("Escrita no outbox falhou sem erro reportado")
}

/**
 * Quando `deliveryCount >= N` (default 20), persiste no outbox
 * `QueueProcessingFailure` e retorna `true` — o caller MUST ack (não relançar).
 * Abaixo do limite retorna `false` para o caller relançar e a Vercel Queue
 * continuar o retry.
 *
 * A escrita no outbox não pode compartilhar o destino do caminho primário: ela
 * tem retry próprio com backoff e, na falha final, emite a tag alertável
 * `dead_letter_write_failed`. Acima de `hardMaxDeliveryCount` (default 100) a
 * mensagem é ackada mesmo sem outbox, com o payload completo no log.
 */
export async function ackAfterMaxDeliveries(
  input: AckAfterMaxDeliveriesInput,
  writer: Pick<IQueueProcessingFailureRepository, "upsertFromProcessingFailure"> = queueProcessingFailureRepository,
  options: AckAfterMaxDeliveriesOptions = {},
): Promise<boolean> {
  const maxDeliveryCount = input.maxDeliveryCount ?? resolveQueueMaxDeliveryCount()
  if (input.deliveryCount < maxDeliveryCount) {
    return false
  }

  const sleep = options.sleep ?? defaultSleep
  const logError =
    options.logError ??
    ((message: string, context: Record<string, unknown>) => console.error(message, context))

  const outboxError = await writeToOutboxWithRetry(input, writer, sleep)
  if (!outboxError) {
    return true
  }

  const hardMaxDeliveryCount =
    input.hardMaxDeliveryCount ?? resolveQueueHardMaxDeliveryCount(undefined, maxDeliveryCount)
  const ackedWithoutOutbox = input.deliveryCount >= hardMaxDeliveryCount

  logError(`[ackAfterMaxDeliveries] ${DEAD_LETTER_WRITE_FAILED_TAG}`, {
    tag: DEAD_LETTER_WRITE_FAILED_TAG,
    topic: input.topic,
    idempotencyKey: input.idempotencyKey,
    deliveryCount: input.deliveryCount,
    hardMaxDeliveryCount,
    attempts: OUTBOX_WRITE_MAX_ATTEMPTS,
    ackedWithoutOutbox,
    outboxError: formatQueueProcessingError(outboxError),
    lastError: formatQueueProcessingError(input.lastError),
    payload: ackedWithoutOutbox ? toJsonPayload(input.payload) : undefined,
  })

  return ackedWithoutOutbox
}
