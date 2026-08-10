/** Backoff for Resend webhook processing failure outbox (D11). */
export const RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS = 5;

const BACKOFF_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export function computeResendWebhookProcessingFailureNextAttemptAt(
  attemptCountAfterFailure: number,
  now = new Date()
): Date | null {
  if (attemptCountAfterFailure >= RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS) {
    return null;
  }
  const idx = Math.max(0, attemptCountAfterFailure - 1);
  const delay =
    BACKOFF_MS[Math.min(idx, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return new Date(now.getTime() + delay);
}

export function shouldRetryResendWebhookProcessingFailure(attemptCount: number): boolean {
  return attemptCount < RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS;
}
