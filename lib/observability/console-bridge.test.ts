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
});
