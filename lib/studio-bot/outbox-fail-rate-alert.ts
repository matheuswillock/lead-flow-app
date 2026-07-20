import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

const FAIL_RATE_THRESHOLD = 0.1;
const MIN_DISPATCHED_FOR_ALERT = 5;

export function evaluateStudioBotOutboxFailRate(input: {
  dispatched: number;
  failed: number;
}): { shouldAlert: boolean; failRate: number } {
  if (input.dispatched < MIN_DISPATCHED_FOR_ALERT) {
    return { shouldAlert: false, failRate: 0 };
  }
  const failRate = input.failed / input.dispatched;
  return {
    shouldAlert: failRate >= FAIL_RATE_THRESHOLD,
    failRate,
  };
}

/** Alerta estruturado quando taxa de falha do cron outbox >= 10% (mín. 5 despachos). */
export function alertStudioBotOutboxFailRate(input: {
  dispatched: number;
  failed: number;
}): void {
  const { shouldAlert, failRate } = evaluateStudioBotOutboxFailRate(input);
  if (!shouldAlert) {
    return;
  }

  const payload = {
    tag: "studio-bot-outbox",
    dispatched: input.dispatched,
    failed: input.failed,
    failRate,
    threshold: FAIL_RATE_THRESHOLD,
  };

  console.error("[StudioBotOutboxCronRoute][GET] Taxa de falha do outbox acima do limiar", payload);

  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("studio-bot-outbox", "fail-rate");
    scope.setFingerprint(["studio-bot-outbox-fail-rate"]);
    scope.setContext("studio_bot_outbox", payload);
    Sentry.captureMessage(
      `Bethânia outbox: taxa de falha ${(failRate * 100).toFixed(1)}% (${input.failed}/${input.dispatched})`
    );
  });
}
