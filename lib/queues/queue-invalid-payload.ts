import type {
  AckAfterMaxDeliveriesFn,
  AckAfterMaxDeliveriesInput,
} from "./queue-processing-failure"

/**
 * Prefixo do `lastError` que identifica o motivo da linha no outbox
 * `QueueProcessingFailure`. O modelo não tem coluna própria de motivo, então a
 * consulta é `lastError like 'invalid_payload%'`.
 */
export const QUEUE_FAILURE_REASON_INVALID_PAYLOAD = "invalid_payload"

export type InvalidPayloadDeadLetterParams = {
  topic: string
  /** Chave do próprio payload. Costuma faltar — é parte do que o torna inválido. */
  idempotencyKeyCandidate: string | null | undefined
  messageId: string
  payload: unknown
  detail: string
}

/**
 * Chave estável para o payload inválido. Cai no `messageId` quando o payload
 * não traz a própria chave, para que reentregas da mesma mensagem colapsem na
 * mesma linha do outbox em vez de multiplicá-la.
 */
export function buildInvalidPayloadIdempotencyKey(
  candidate: string | null | undefined,
  messageId: string,
): string {
  const trimmed = typeof candidate === "string" ? candidate.trim() : ""
  return trimmed || `${QUEUE_FAILURE_REASON_INVALID_PAYLOAD}:${messageId}`
}

/**
 * Monta a entrada de dead-letter para um payload inválido.
 *
 * Payload inválido é bug de produtor: nenhuma reentrega conserta e o ack mudo
 * o torna invisível até alguém procurar. Por isso o limite vai a 1 — a linha
 * é gravada no outbox já na primeira entrega, antes do ack.
 */
export function buildInvalidPayloadDeadLetterInput(
  params: InvalidPayloadDeadLetterParams,
): AckAfterMaxDeliveriesInput {
  return {
    deliveryCount: 1,
    maxDeliveryCount: 1,
    topic: params.topic,
    idempotencyKey: buildInvalidPayloadIdempotencyKey(
      params.idempotencyKeyCandidate,
      params.messageId,
    ),
    payload: params.payload,
    lastError: `${QUEUE_FAILURE_REASON_INVALID_PAYLOAD}: ${params.detail}`,
  }
}

/** Nomes dos campos obrigatórios que chegaram vazios. */
export function listMissingRequiredFields(fields: Record<string, unknown>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([name]) => name)
}

export function describeMissingRequiredFields(missingFields: string[]): string {
  return `campos obrigatórios ausentes: ${missingFields.join(", ")}`
}

/**
 * Registra o payload inválido no outbox antes do ack. Best-effort: uma falha
 * aqui não pode transformar um payload inválido — que nenhuma reentrega
 * conserta — em mensagem retida na fila.
 */
export async function deadLetterInvalidPayload(
  params: InvalidPayloadDeadLetterParams,
  ack: AckAfterMaxDeliveriesFn,
): Promise<void> {
  try {
    await ack(buildInvalidPayloadDeadLetterInput(params))
  } catch (deadLetterError) {
    console.error(
      `[deadLetterInvalidPayload] falha ao registrar ${QUEUE_FAILURE_REASON_INVALID_PAYLOAD}`,
      { topic: params.topic, messageId: params.messageId, deadLetterError },
    )
  }
}
