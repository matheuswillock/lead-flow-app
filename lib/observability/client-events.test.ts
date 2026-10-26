import { describe, expect, test } from "bun:test";

import { parseClientEvent } from "./client-events";

describe("client observability events", () => {
  test("accepts only the allowlisted event shape", () => {
    expect(parseClientEvent({ level: "error", message: "render failed", route: "/dashboard" })).toEqual({
      level: "error",
      message: "render failed",
      route: "/dashboard",
    });
  });

  test("rejects invalid levels, empty messages and unknown fields", () => {
    expect(parseClientEvent({ level: "info", message: "ignored" })).toBeNull();
    expect(parseClientEvent({ level: "error", message: "" })).toBeNull();
    expect(parseClientEvent({ level: "error", message: "x", token: "secret" })).toBeNull();
  });

  test("rejects oversized messages and stacks", () => {
    expect(parseClientEvent({ level: "error", message: "x".repeat(501) })).toBeNull();
    expect(parseClientEvent({ level: "error", message: "x", stack: "x".repeat(4001) })).toBeNull();
  });
});
