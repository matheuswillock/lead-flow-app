import { describe, expect, mock, test } from "bun:test";

const consumeRateLimit = mock(async () => ({ allowed: true, retryAfterSeconds: 0 }));

mock.module("@/lib/public-forms/rate-limit", () => ({
  consumePublicFormRateLimit: consumeRateLimit,
  publicFormRequestFingerprint: () => "test-ip",
}));

const { POST } = await import("./route");

describe("POST /api/v1/observability/client-events", () => {
  test("accepts a valid allowlisted browser event", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/observability/client-events", {
        method: "POST",
        body: JSON.stringify({ level: "error", message: "render failed", route: "/dashboard" }),
      }),
    );

    expect(response.status).toBe(202);
  });

  test("rejects invalid JSON and unknown fields", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/observability/client-events", {
        method: "POST",
        body: JSON.stringify({ level: "info", message: "not accepted", token: "secret" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("rejects a body larger than the transport limit", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/observability/client-events", {
        method: "POST",
        body: JSON.stringify({ level: "error", message: "x".repeat(9_000) }),
      }),
    );

    expect(response.status).toBe(413);
  });

  test("returns retry information when rate limited", async () => {
    consumeRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });

    const response = await POST(
      new Request("http://localhost/api/v1/observability/client-events", {
        method: "POST",
        body: JSON.stringify({ level: "error", message: "too many" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
  });
});
