import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import http from "node:http";

mock.module("@/lib/webhooks/ssrfUrlGuard", () => ({
  assertSafeWebhookTargetUrlResolved: async (targetUrl: string) => ({
    ok: true as const,
    url: new URL(targetUrl),
    pinnedAddress: "127.0.0.1",
    pinnedFamily: 4 as const,
  }),
}));

const { WebhookHttpDeliveryService } = await import("./WebhookHttpDeliveryService");

describe("WebhookHttpDeliveryService", () => {
  let server: http.Server;
  let port: number;
  let receivedBody = "";
  let receivedHeaders: http.IncomingHttpHeaders = {};

  beforeAll(async () => {
    server = http.createServer((request, response) => {
      receivedHeaders = request.headers;
      receivedBody = "";
      request.on("data", (chunk) => {
        receivedBody += chunk.toString();
      });
      request.on("end", () => {
        if (request.url === "/failure") {
          response.writeHead(503, { "Content-Type": "text/plain" });
          response.end("temporarily unavailable");
          return;
        }
        response.writeHead(202, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ accepted: true }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Porta HTTP indisponível");
    port = address.port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  });

  test("entrega JSON usando o IP validado quando o runtime solicita todos os endereços", async () => {
    const service = new WebhookHttpDeliveryService();
    const result = await service.deliver({
      targetUrl: `http://webhook.test:${port}/events`,
      preset: "generic",
      body: { event: "lead_created" },
    });

    expect(result).toEqual({
      ok: true,
      statusCode: 202,
      responseBody: { accepted: true },
      errorMessage: null,
    });
    expect(JSON.parse(receivedBody)).toEqual({ event: "lead_created" });
    expect(receivedHeaders.host).toBe(`webhook.test:${port}`);
    expect(receivedHeaders["content-type"]).toBe("application/json");
    expect(receivedHeaders["x-corretor-studio-preset"]).toBe("generic");
  });

  test("descreve respostas HTTP recusadas e preserva o corpo recebido", async () => {
    const service = new WebhookHttpDeliveryService();
    const result = await service.deliver({
      targetUrl: `http://webhook.test:${port}/failure`,
      preset: "generic",
      body: { event: "lead_created" },
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 503,
      responseBody: "temporarily unavailable",
      errorMessage: "HTTP 503",
    });
  });

});
