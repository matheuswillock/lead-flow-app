import { describe, expect, test } from "bun:test";

import { installStructuredConsoleBridge } from "./console-bridge";

describe("structured console bridge", () => {
  test("converts legacy bracketed console calls to structured JSON", () => {
    const lines: string[] = [];
    const originalInfo = console.info;

    const restore = installStructuredConsoleBridge({ write: (line) => lines.push(line) });
    try {
      console.info("[LegacyRoute][GET] loaded", { requestId: "req-1" });
    } finally {
      restore();
      console.info = originalInfo;
    }

    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.scope).toBe("LegacyRoute");
    expect(entry.msg).toBe("[GET] loaded");
    expect(entry.source).toBe("legacy-console");
  });

  test("is idempotent and restores all console methods", () => {
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    const restore = installStructuredConsoleBridge({ write: () => undefined });
    const secondRestore = installStructuredConsoleBridge({ write: () => { throw new Error("must not install twice"); } });

    secondRestore();
    expect(console.info).not.toBe(originalInfo);
    restore();
    expect(console.info).toBe(originalInfo);
    expect(console.warn).toBe(originalWarn);
    expect(console.error).toBe(originalError);
  });
});
