import { createWebhookRetryBackoffPolicy } from "./webhookRetryBackoff";

/** Backoff do outbox de webhooks outbound. Mesma política do Asaas (W18), ver `webhookRetryBackoff.ts`. */
export const TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS = 5;

const policy = createWebhookRetryBackoffPolicy(TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS);

export function computeWebhookOutboxNextAttemptAt(
  attemptCountAfterFailure: number,
  now = new Date()
): Date | null {
  return policy.computeNextAttemptAt(attemptCountAfterFailure, now);
}

export function shouldRetryWebhookOutbox(attemptCount: number): boolean {
  return policy.shouldRetry(attemptCount);
}
