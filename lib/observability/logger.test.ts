import { describe, expect, test } from "bun:test";

import { createLogger, sanitize } from "./logger";

describe("structured logger", () => {
  test("writes one JSON line with level, scope, message and fields", () => {
    const lines: string[] = [];
    const logger = createLogger("test", { write: (line) => lines.push(line) });

    logger.info("collection started", { clientId: "abc" });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.scope).toBe("test");
    expect(entry.msg).toBe("collection started");
    expect(entry.clientId).toBe("abc");
    expect(typeof entry.ts).toBe("string");
  });

  test("inherits and overrides child context", () => {
    const lines: string[] = [];
    const logger = createLogger("route", { write: (line) => lines.push(line) });

    logger.child({ requestId: "req-1", clientId: "c1" }).child({ clientId: "c2" }).warn("slow");

    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.requestId).toBe("req-1");
    expect(entry.clientId).toBe("c2");
  });

  test("serializes errors without exposing the raw object", () => {
    const lines: string[] = [];
    const logger = createLogger("test", { write: (line) => lines.push(line) });

    logger.error("failed", { error: new Error("boom") });

    expect(JSON.parse(lines[0]).error).toEqual({ name: "Error", message: "boom" });
  });

  test("sanitizes an error cause and stack-like secret text", () => {
    const lines: string[] = [];
    const logger = createLogger("test", { write: (line) => lines.push(line) });
    const error = new Error("outer Bearer outer-secret", { cause: new Error("postgresql://admin:db-secret@db.internal/app") });

    logger.error("failed", { error, stack: "Authorization: Bearer stack-secret" });

    expect(lines[0]).not.toContain("outer-secret");
    expect(lines[0]).not.toContain("db-secret");
    expect(lines[0]).not.toContain("stack-secret");
    expect(lines[0]).toContain("db.internal");
  });

  test("redacts secret keys and secret patterns recursively", () => {
    const value = sanitize({
      accessToken: "abc",
      nested: { refresh_token: "def", cookie: "ghi" },
      authorization: "Bearer x",
      password: "secret",
      normal: "Bearer abc123 and sk-live-value",
      databaseUrl: "postgresql://admin:password@db.internal:5432/app",
    });

    expect(value).toEqual({
      accessToken: "[redacted]",
      nested: { refresh_token: "[redacted]", cookie: "[redacted]" },
      authorization: "[redacted]",
      password: "[redacted]",
      normal: "Bearer [redacted] and sk-[redacted]",
      databaseUrl: "[redacted]",
    });
  });

  test("handles errors, special values, repeated references and cycles", () => {
    const repeated = { value: "safe" };
    const map = new Map<string, unknown>([["safe", repeated]]);
    const set = new Set(["safe", "Bearer set-secret"]);
    const nested: Record<string, unknown> = {};
    const circular: Record<string, unknown> = { repeated, bigint: BigInt(3), date: new Date("2026-01-01T00:00:00.000Z"), map, set, nested };
    circular.self = circular;
    circular.again = repeated;
    nested.parent = circular;

    expect(() => sanitize(circular)).not.toThrow();
    expect(sanitize(circular)).toMatchObject({
      bigint: "3",
      date: "2026-01-01T00:00:00.000Z",
      map: { safe: { value: "safe" } },
      set: ["safe", "Bearer [redacted]"],
      self: "[circular]",
      repeated: { value: "safe" },
      again: { value: "safe" },
    });
  });

  test("falls back when the writer throws and does not throw to the caller", () => {
    const writes: string[] = [];
    let attempts = 0;
    const logger = createLogger("test", {
      write: (line) => {
        attempts += 1;
        if (attempts === 1) throw new Error("writer unavailable");
        writes.push(line);
      },
    });

    expect(() => logger.info("safe")).not.toThrow();
    expect(writes[0]).toContain('"msg":"log failed"');
  });

  test("bounds oversized messages and fields", () => {
    const lines: string[] = [];
    const logger = createLogger("test", { write: (line) => lines.push(line), maxBytes: 512 });

    logger.info("x".repeat(2_000), { details: "y".repeat(2_000) });

    expect(new TextEncoder().encode(lines[0]).byteLength).toBeLessThanOrEqual(512);
    expect(JSON.parse(lines[0]).details).toBeUndefined();
  });

  test("limits deeply nested and oversized collections", () => {
    const sanitized = sanitize({
      values: Array.from({ length: 101 }, (_, index) => index),
      fields: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`field${index}`, index])),
      deep: { one: { two: { three: { four: { five: { six: { seven: { eight: { nine: "too deep" } } } } } } } } },
    }) as Record<string, unknown>;

    expect((sanitized.values as unknown[]).at(-1)).toBe("[1 items truncated]");
    expect((sanitized.fields as Record<string, unknown>).__truncated).toBe("[1 fields truncated]");
  });
});
