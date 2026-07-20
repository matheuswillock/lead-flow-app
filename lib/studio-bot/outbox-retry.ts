/**
 * Backoff do outbox Bethânia (SPEC follow-up #2).
 * Tentativas 1..5 → 1m, 5m, 15m, 1h, 6h. Acima de MAX_ATTEMPTS não retenta.
 */
export const STUDIO_BOT_OUTBOX_MAX_ATTEMPTS = 5;

const BACKOFF_MS = [
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  60 * 60_000, // 1h
  6 * 60 * 60_000, // 6h
] as const;

export function computeOutboxNextAttemptAt(
  attemptCountAfterFailure: number,
  now = new Date()
): Date | null {
  if (attemptCountAfterFailure >= STUDIO_BOT_OUTBOX_MAX_ATTEMPTS) {
    return null;
  }
  const idx = Math.max(0, attemptCountAfterFailure - 1);
  const delay = BACKOFF_MS[Math.min(idx, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return new Date(now.getTime() + delay);
}

export function shouldRetryOutboxEvent(attemptCount: number): boolean {
  return attemptCount < STUDIO_BOT_OUTBOX_MAX_ATTEMPTS;
}
