import { randomUUID } from "node:crypto"

/**
 * A Vercel Queues deduplica `send()` pela `idempotencyKey`. Reusar a chave
 * original (já acked) ou a mesma chave de um republish anterior é no-op.
 * Cada enqueue do outbox leva um nonce; a dedupe de negócio continua no
 * Postgres (`eventId` / chave de negócio).
 */
export function buildOutboxRetryIdempotencyKey(input: {
  originalKey: string
  outboxRowId: string
  attemptCount: number
}): string {
  return `${input.originalKey}:outbox-retry:${input.outboxRowId}:${input.attemptCount}:${randomUUID()}`
}
