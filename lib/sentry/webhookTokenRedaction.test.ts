import { describe, expect, it } from "bun:test";
import type { Event } from "@sentry/nextjs";
import { applyWebhookTokenRedaction, redactStudioWebhookTokenInUrl } from "./webhookTokenRedaction";

/**
 * SPEC 10, A-E5 (T-10.15) — beforeSend/beforeSendTransaction reescrevem URL,
 * span e breadcrumb com token para [redacted]. Controle negativo obrigatório
 * executado manualmente durante a implementação (comentar o hook nos
 * arquivos sentry.*.config.ts e ver o token aparecer no evento — restaurado
 * em seguida, conferido por `git diff`; ver relatório do implementador).
 */
const TOKEN_URL = "https://app.example.com/api/webhooks/studio/11111111-1111-4111-8111-111111111111/super-secret-token-value";
const REDACTED_URL = "https://app.example.com/11111111-1111-4111-8111-111111111111/[redacted]";

describe("redactStudioWebhookTokenInUrl", () => {
  it("reescreve /api/webhooks/studio/{teamId}/{token} para /{teamId}/[redacted]", () => {
    expect(redactStudioWebhookTokenInUrl(TOKEN_URL)).toBe(REDACTED_URL);
  });

  it("não mexe em URLs sem token no path (rota sem token, DA4)", () => {
    const noTokenUrl = "https://app.example.com/api/webhooks/studio/11111111-1111-4111-8111-111111111111";
    expect(redactStudioWebhookTokenInUrl(noTokenUrl)).toBe(noTokenUrl);
  });

  it("não mexe em URLs completamente diferentes", () => {
    const other = "https://app.example.com/api/v1/leads/123";
    expect(redactStudioWebhookTokenInUrl(other)).toBe(other);
  });
});

describe("applyWebhookTokenRedaction (T-10.15)", () => {
  it("redige event.request.url", () => {
    const event: Event = { request: { url: TOKEN_URL } };
    const redacted = applyWebhookTokenRedaction(event);
    expect(redacted.request?.url).toBe(REDACTED_URL);
  });

  it("redige event.transaction (nome da transação de performance)", () => {
    const event: Event = { transaction: `POST ${TOKEN_URL}` };
    const redacted = applyWebhookTokenRedaction(event);
    expect(redacted.transaction).toBe(`POST ${REDACTED_URL}`);
  });

  it("redige breadcrumbs (message e data.url)", () => {
    const event: Event = {
      breadcrumbs: [
        { message: `Fetch ${TOKEN_URL}`, category: "fetch" },
        { data: { url: TOKEN_URL }, category: "fetch" },
      ],
    };
    const redacted = applyWebhookTokenRedaction(event);
    expect(redacted.breadcrumbs?.[0]?.message).toBe(`Fetch ${REDACTED_URL}`);
    expect((redacted.breadcrumbs?.[1]?.data as { url?: string } | undefined)?.url).toBe(REDACTED_URL);
  });

  it("redige spans (description e data['http.url'])", () => {
    const event = {
      spans: [{ description: `GET ${TOKEN_URL}`, data: { "http.url": TOKEN_URL } }],
    } as unknown as Event;
    const redacted = applyWebhookTokenRedaction(event) as unknown as {
      spans: Array<{ description: string; data: Record<string, unknown> }>;
    };
    expect(redacted.spans[0]?.description).toBe(`GET ${REDACTED_URL}`);
    expect(redacted.spans[0]?.data["http.url"]).toBe(REDACTED_URL);
  });

  it("R10-3: redige contexts.trace.data['http.target'] e ['http.url'] (transação http.server)", () => {
    const event = {
      contexts: {
        trace: {
          data: {
            "http.target": `/api/webhooks/studio/11111111-1111-4111-8111-111111111111/super-secret-token-value`,
            "http.url": TOKEN_URL,
          },
        },
      },
    } as unknown as Event;

    const redacted = applyWebhookTokenRedaction(event) as unknown as {
      contexts: { trace: { data: Record<string, unknown> } };
    };

    // http.target não tem origin — o padrão de redação precisa bater em
    // paths relativos, não só em URLs absolutas.
    expect(redacted.contexts.trace.data["http.target"]).toBe("/11111111-1111-4111-8111-111111111111/[redacted]");
    expect(redacted.contexts.trace.data["http.url"]).toBe(REDACTED_URL);
  });

  it("R10-3, rodada 2 — redige contexts.trace.data['url.full'] e ['url.path'] (SDK 10, @sentry/core/utils/url.js)", () => {
    const event = {
      contexts: {
        trace: {
          data: {
            "url.full": TOKEN_URL,
            "url.path": "/api/webhooks/studio/11111111-1111-4111-8111-111111111111/super-secret-token-value",
          },
        },
      },
    } as unknown as Event;

    const redacted = applyWebhookTokenRedaction(event) as unknown as {
      contexts: { trace: { data: Record<string, unknown> } };
    };

    expect(redacted.contexts.trace.data["url.full"]).toBe(REDACTED_URL);
    expect(redacted.contexts.trace.data["url.path"]).toBe(
      "/11111111-1111-4111-8111-111111111111/[redacted]"
    );
  });

  it("R10-3, rodada 2 — redige spans[].data['url.full'] e ['url.path']", () => {
    const event = {
      spans: [{ data: { "url.full": TOKEN_URL, "url.path": "/api/webhooks/studio/11111111-1111-4111-8111-111111111111/x" } }],
    } as unknown as Event;

    const redacted = applyWebhookTokenRedaction(event) as unknown as {
      spans: Array<{ data: Record<string, unknown> }>;
    };

    expect(redacted.spans[0]?.data["url.full"]).toBe(REDACTED_URL);
    expect(redacted.spans[0]?.data["url.path"]).toBe("/11111111-1111-4111-8111-111111111111/[redacted]");
  });

  it("redige o header referer quando presente", () => {
    const event: Event = { request: { url: "https://app.example.com/", headers: { referer: TOKEN_URL } } };
    const redacted = applyWebhookTokenRedaction(event);
    expect(redacted.request?.headers?.referer).toBe(REDACTED_URL);
  });

  it("evento sem nenhum campo sensível não quebra (idempotente)", () => {
    const event: Event = { message: "algo qualquer" };
    expect(() => applyWebhookTokenRedaction(event)).not.toThrow();
  });
});
