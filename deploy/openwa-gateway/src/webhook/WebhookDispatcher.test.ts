import { describe, it, expect, mock } from "bun:test";
import { createHmac } from "node:crypto";
import { WebhookDispatcher } from "./WebhookDispatcher.js";

const SECRET = "webhook-secret-min-32-chars-long!!";
const noDelay = async (_ms: number) => {};

function makeDispatcher(fetchFn: typeof fetch) {
  return new WebhookDispatcher({ fetchFn, delayFn: noDelay, secret: SECRET });
}

function verifySignature(body: string, header: string): boolean {
  const expected = createHmac("sha256", SECRET).update(body).digest("hex");
  return header === `sha256=${expected}`;
}

describe("WebhookDispatcher", () => {
  it("envia com HMAC correto no sucesso", async () => {
    let capturedBody = "";
    let capturedSig = "";

    const fetchMock = mock(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      capturedSig = (init?.headers as Record<string, string>)["x-openwa-signature"];
      return new Response(null, { status: 200 });
    });

    const dispatcher = makeDispatcher(fetchMock as unknown as typeof fetch);
    await dispatcher.send("https://example.com/webhook", "inst-1", "message", { text: "oi" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(capturedBody);
    expect(parsed.instance).toBe("inst-1");
    expect(parsed.event).toBe("message");
    expect(verifySignature(capturedBody, capturedSig)).toBe(true);
  });

  it("retenta em HTTP 500 e para após max tentativas", async () => {
    let calls = 0;
    const fetchMock = mock(async () => {
      calls++;
      return new Response(null, { status: 500 });
    });

    const dispatcher = makeDispatcher(fetchMock as unknown as typeof fetch);
    await dispatcher.send("https://example.com/webhook", "inst-1", "qr", {});

    expect(calls).toBe(4); // 1 inicial + 3 retries
  });

  it("retenta em erro de rede e para após max tentativas", async () => {
    let calls = 0;
    const fetchMock = mock(async () => {
      calls++;
      throw new Error("Network error");
    });

    const dispatcher = makeDispatcher(fetchMock as unknown as typeof fetch);
    await dispatcher.send("https://example.com/webhook", "inst-1", "ready", {});

    expect(calls).toBe(4);
  });

  it("para após sucesso no segundo retry", async () => {
    let calls = 0;
    const fetchMock = mock(async () => {
      calls++;
      if (calls < 3) return new Response(null, { status: 503 });
      return new Response(null, { status: 200 });
    });

    const dispatcher = makeDispatcher(fetchMock as unknown as typeof fetch);
    await dispatcher.send("https://example.com/webhook", "inst-1", "disconnected", {});

    expect(calls).toBe(3);
  });

  it("não lança exceção após max falhas", async () => {
    const fetchMock = mock(async () => { throw new Error("timeout"); });

    const dispatcher = makeDispatcher(fetchMock as unknown as typeof fetch);
    // Não deve rejeitar
    await expect(
      dispatcher.send("https://example.com/webhook", "inst-1", "message", {})
    ).resolves.toBeUndefined();
  });
});
