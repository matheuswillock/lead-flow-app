/** Backoff for Asaas webhook event outbox (PR2.2). */
export const ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS = 5;

const BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export function computeAsaasWebhookEventNextAttemptAt(
  attemptCountAfterFailure: number,
  now = new Date()
): Date | null {
  if (attemptCountAfterFailure >= ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS) {
    return null;
  }
  const idx = Math.max(0, attemptCountAfterFailure - 1);
  const delay =
    BACKOFF_MS[Math.min(idx, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return new Date(now.getTime() + delay);
}

export function shouldRetryAsaasWebhookEvent(attemptCount: number): boolean {
  return attemptCount < ASAAS_WEBHOOK_EVENT_MAX_ATTEMPTS;
}
