import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { verifyWebhookSignature } from "@/lib/webhooks/webhookSigningSecurity";

let capturedHeaders: http.IncomingHttpHeaders = {};
let capturedBody = "";
let baseUrl = "";

const server = http.createServer((req, res) => {
  capturedHeaders = req.headers;
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    capturedBody = Buffer.concat(chunks).toString("utf8");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
});

// A entrega real passa pelo guard de SSRF, que bloqueia localhost por design
// (é o comportamento correto em produção). Para testar o transporte HTTP e
// os headers de assinatura isoladamente, o guard é mockado como "seguro"
// apontando exatamente para o servidor local deste teste.
mock.module("@/lib/webhooks/ssrfUrlGuard", () => ({
  assertSafeWebhookTargetUrlResolved: async (targetUrl: string) => ({
    ok: true,
    url: new URL(targetUrl),
  }),
}));

const { WebhookHttpDeliveryService } = await import("./WebhookHttpDeliveryService");

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/hook`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("WebhookHttpDeliveryService", () => {
  it("T-20.1/T-20.3: envia assinatura, timestamp e versão do evento verificáveis", async () => {
    const service = new WebhookHttpDeliveryService();
    const secret = "segredo-de-teste-0123456789";

    const result = await service.deliver({
      targetUrl: baseUrl,
      preset: "generic",
      body: { id: "evt_1", version: 1, data: { a: 1 } },
      signingSecret: secret,
    });

    expect(result.ok).toBe(true);

    const signatureHeader = capturedHeaders["x-corretor-studio-signature"];
    const timestampHeader = capturedHeaders["x-corretor-studio-timestamp"];
    const versionHeader = capturedHeaders["x-corretor-studio-event-version"];

    expect(typeof signatureHeader).toBe("string");
    expect(typeof timestampHeader).toBe("string");
    expect(versionHeader).toBe("1");

    const verified = verifyWebhookSignature({
      secret,
      timestamp: timestampHeader as string,
      rawBody: capturedBody,
      signatureHeader: signatureHeader as string,
    });
    expect(verified).toBe(true);
  });

  it("sem segredo configurado, ainda envia a versão do evento mas sem assinatura", async () => {
    const service = new WebhookHttpDeliveryService();

    const result = await service.deliver({
      targetUrl: baseUrl,
      preset: "generic",
      body: { id: "evt_2", version: 1 },
      signingSecret: null,
    });

    expect(result.ok).toBe(true);
    expect(capturedHeaders["x-corretor-studio-event-version"]).toBe("1");
    expect(capturedHeaders["x-corretor-studio-signature"]).toBeUndefined();
  });
});
