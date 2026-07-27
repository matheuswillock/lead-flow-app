import { describe, expect, test } from "bun:test";
import { assertSafeWebhookTargetUrl } from "./ssrfUrlGuard";

describe("assertSafeWebhookTargetUrl", () => {
  test("aceita HTTPS público", () => {
    const result = assertSafeWebhookTargetUrl("https://hooks.slack.com/services/T/B/X");
    expect(result.ok).toBe(true);
  });

  test("rejeita URL vazia", () => {
    const result = assertSafeWebhookTargetUrl("  ");
    expect(result.ok).toBe(false);
  });

  test("rejeita localhost", () => {
    const result = assertSafeWebhookTargetUrl("https://localhost/hook");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("privada");
    }
  });

  test("rejeita IP privado", () => {
    const result = assertSafeWebhookTargetUrl("https://192.168.0.10/hook");
    expect(result.ok).toBe(false);
  });

  test("rejeita http quando allowHttpInDev=false", () => {
    const result = assertSafeWebhookTargetUrl("http://example.com/hook", {
      allowHttpInDev: false,
    });
    expect(result.ok).toBe(false);
  });
});
