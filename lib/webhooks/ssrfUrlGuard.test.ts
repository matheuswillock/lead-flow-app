import { describe, expect, test } from "bun:test";
import {
  assertSafeWebhookTargetUrl,
  assertSafeWebhookTargetUrlResolved,
  isPrivateIpAddress,
} from "./ssrfUrlGuard";

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

describe("isPrivateIpAddress", () => {
  test("detecta IPv4 privados e link-local", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("10.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("169.254.169.254")).toBe(true);
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
  });
});

describe("assertSafeWebhookTargetUrlResolved", () => {
  test("rejeita IP literal privado após resolução", async () => {
    const result = await assertSafeWebhookTargetUrlResolved("https://169.254.169.254/latest");
    expect(result.ok).toBe(false);
  });

  test("aceita host público e pinna endereço", async () => {
    const result = await assertSafeWebhookTargetUrlResolved("https://example.com/hook");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinnedAddress).toBeTruthy();
      expect(result.pinnedFamily === 4 || result.pinnedFamily === 6).toBe(true);
    }
  });
});
