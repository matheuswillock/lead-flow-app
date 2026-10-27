/**
 * Política de backoff compartilhada entre o outbox do Asaas e o outbox de
 * webhooks de saída (W18 — achado de duplicação byte-a-byte entre
 * `asaas-webhook-event-backoff.ts` e `webhookOutboxBackoff.ts`).
 *
 * Cada consumidor mantém seus próprios nomes exportados (constantes e
 * funções), apenas delegando o cálculo para esta fábrica — nenhum import
 * existente precisa mudar.
 */

/** Degraus de espera entre tentativas, em milissegundos. */
export const WEBHOOK_RETRY_BACKOFF_STEPS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export type WebhookRetryBackoffPolicy = {
  maxAttempts: number;
  computeNextAttemptAt: (attemptCountAfterFailure: number, now?: Date) => Date | null;
  shouldRetry: (attemptCount: number) => boolean;
};

export function createWebhookRetryBackoffPolicy(
  maxAttempts: number,
  steps: readonly number[] = WEBHOOK_RETRY_BACKOFF_STEPS_MS
): WebhookRetryBackoffPolicy {
  return {
    maxAttempts,
    computeNextAttemptAt(attemptCountAfterFailure: number, now: Date = new Date()): Date | null {
      if (attemptCountAfterFailure >= maxAttempts) {
        return null;
      }
      const idx = Math.max(0, attemptCountAfterFailure - 1);
      const delay = steps[Math.min(idx, steps.length - 1)] ?? steps[steps.length - 1];
      return new Date(now.getTime() + delay);
    },
    shouldRetry(attemptCount: number): boolean {
      return attemptCount < maxAttempts;
    },
  };
}
