import { describe, expect, test } from "bun:test";
import {
  STUDIO_BOT_OUTBOX_MAX_ATTEMPTS,
  computeOutboxNextAttemptAt,
  shouldRetryOutboxEvent,
} from "./outbox-retry";

describe("outbox-retry", () => {
  test("backoff cresce com attemptCount", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    const a1 = computeOutboxNextAttemptAt(1, now);
    const a2 = computeOutboxNextAttemptAt(2, now);
    const a3 = computeOutboxNextAttemptAt(3, now);
    expect(a1?.getTime()).toBe(now.getTime() + 60_000);
    expect(a2?.getTime()).toBe(now.getTime() + 5 * 60_000);
    expect(a3?.getTime()).toBe(now.getTime() + 15 * 60_000);
  });

  test("não agenda após MAX_ATTEMPTS", () => {
    expect(computeOutboxNextAttemptAt(STUDIO_BOT_OUTBOX_MAX_ATTEMPTS)).toBeNull();
    expect(shouldRetryOutboxEvent(STUDIO_BOT_OUTBOX_MAX_ATTEMPTS)).toBe(false);
    expect(shouldRetryOutboxEvent(0)).toBe(true);
  });
});
