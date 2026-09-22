import { createWebhookRetryBackoffPolicy } from "./webhookRetryBackoff";

/** Backoff for Asaas webhook event outbox (PR2.2). Mesma política do outbox de webhooks (W18), ver `webhookRetryBackoff.ts`. */
export const ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS = 5;

const policy = createWebhookRetryBackoffPolicy(ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS);

export function computeAsaasWebhookEventNextAttemptAt(
  attemptCountAfterFailure: number,
  now = new Date()
): Date | null {
  return policy.computeNextAttemptAt(attemptCountAfterFailure, now);
}

export function shouldRetryAsaasWebhookEvent(attemptCount: number): boolean {
  return policy.shouldRetry(attemptCount);
}
