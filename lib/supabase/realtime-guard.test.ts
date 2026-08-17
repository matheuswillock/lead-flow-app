import { afterEach, describe, expect, test } from "bun:test";
import {
  isRealtimeDisabled,
  logRealtimeDisabledOnce,
  resetRealtimeDisabledLogForTests,
  shouldSkipRealtimeSubscribe,
} from "./realtime-guard";

describe("realtime-guard", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_REALTIME_DISABLED;
    resetRealtimeDisabledLogForTests();
  });

  test("isRealtimeDisabled is false by default", () => {
    expect(isRealtimeDisabled()).toBe(false);
  });

  test("isRealtimeDisabled is true when NEXT_PUBLIC_REALTIME_DISABLED=true", () => {
    process.env.NEXT_PUBLIC_REALTIME_DISABLED = "true";
    expect(isRealtimeDisabled()).toBe(true);
  });

  test("shouldSkipRealtimeSubscribe is false when the flag is off", () => {
    expect(shouldSkipRealtimeSubscribe()).toBe(false);
  });

  test("shouldSkipRealtimeSubscribe is true and logs once when disabled", () => {
    process.env.NEXT_PUBLIC_REALTIME_DISABLED = "true";
    const originalInfo = console.info;
    const messages: string[] = [];
    console.info = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    };

    try {
      expect(shouldSkipRealtimeSubscribe()).toBe(true);
      expect(shouldSkipRealtimeSubscribe()).toBe(true);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain("NEXT_PUBLIC_REALTIME_DISABLED");
    } finally {
      console.info = originalInfo;
    }
  });

  test("logRealtimeDisabledOnce is a no-op when already logged", () => {
    const originalInfo = console.info;
    const messages: string[] = [];
    console.info = (...args: unknown[]) => {
      messages.push(args.map(String).join(" "));
    };

    try {
      logRealtimeDisabledOnce();
      logRealtimeDisabledOnce();
      expect(messages).toHaveLength(1);
    } finally {
      console.info = originalInfo;
    }
  });
});
