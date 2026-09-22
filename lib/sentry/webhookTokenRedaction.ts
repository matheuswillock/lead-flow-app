import type { Breadcrumb, Event } from "@sentry/nextjs";

/**
 * SPEC 10, A-E5 (DA5, V7) — o Sentry captura a URL do webhook de entrada
 * inteira, token incluído (`/api/webhooks/studio/{teamId}/{token}`), com
 * `sendDefaultPii: true` e `tracesSampleRate: 1`. Este módulo reescreve essa
 * URL para `/{teamId}/[redacted]` em qualquer lugar de um evento do Sentry
 * onde ela possa aparecer (URL da requisição, nome da transação, spans e
 * breadcrumbs), no servidor e no edge. Não depende de desligar
 * `sendDefaultPii` para o app inteiro (D19).
 *
 * Na v2 ([[11]]) o token nem chega ao path, mas a v1 continua em produção
 * até o sunset (D10) — este hook cobre as duas rotas do legado
 * (`[teamId]/route.ts` e `[teamId]/[token]/route.ts`).
 */
const STUDIO_WEBHOOK_TOKEN_URL_PATTERN = /\/api\/webhooks\/studio\/([0-9a-fA-F-]{8,})\/[^/?\s"']+/g;

export const redactStudioWebhookTokenInUrl = (value: string): string => {
  return value.replace(STUDIO_WEBHOOK_TOKEN_URL_PATTERN, "/$1/[redacted]");
};

/**
 * R10-3, rodada 2 (revisão Opus) — o Sentry SDK 10 grava a URL/o path do
 * webhook em vários atributos além de `http.target`/`http.url`
 * (`url.full`, `url.path`, e possivelmente outros que o SDK adicionar no
 * futuro — `@sentry/core/build/cjs/utils/url.js` e `requestdata.js`).
 * Manter uma lista fixa de chaves é uma corrida armamentista com o SDK.
 * Em vez disso, redige QUALQUER valor string dentro de um objeto de
 * atributos (`contexts.trace.data`, `spans[].data`) — o pior caso é
 * redigir uma URL que não continha o token, o que é aceitável (a máscara
 * é um no-op para strings sem o padrão `/api/webhooks/studio/{teamId}/*`).
 */
const redactAllStringValuesInObject = (data: Record<string, unknown>): Record<string, unknown> => {
  const redacted: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === "string") {
      redacted[key] = redactStudioWebhookTokenInUrl(value);
    }
  }
  return redacted;
};

const redactBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => {
  const redacted: Breadcrumb = { ...breadcrumb };

  if (typeof redacted.message === "string") {
    redacted.message = redactStudioWebhookTokenInUrl(redacted.message);
  }

  if (redacted.data && typeof redacted.data === "object") {
    redacted.data = redactAllStringValuesInObject(redacted.data as Record<string, unknown>);
  }

  return redacted;
};

/**
 * Aplica a redação em todos os campos de um `Event`/`TransactionEvent` do
 * Sentry onde a URL do webhook pode vazar. Usado como `beforeSend` e
 * `beforeSendTransaction` — as duas assinaturas recebem um shape compatível.
 */
export const applyWebhookTokenRedaction = <T extends Event>(event: T): T => {
  if (event.request?.url) {
    event.request = { ...event.request, url: redactStudioWebhookTokenInUrl(event.request.url) };
  }

  if (event.request?.headers?.referer) {
    event.request = {
      ...event.request,
      headers: {
        ...event.request.headers,
        referer: redactStudioWebhookTokenInUrl(event.request.headers.referer),
      },
    };
  }

  if (typeof event.transaction === "string") {
    event.transaction = redactStudioWebhookTokenInUrl(event.transaction);
  }

  // R10-3: transações `http.server` guardam a URL/o path em
  // `contexts.trace.data` — `http.target`, `http.url`, e (SDK 10) também
  // `url.full`/`url.path` gravados por @sentry/core/utils/url.js e
  // requestdata.js. Em vez de listar cada chave, redige QUALQUER string
  // do objeto de atributos (ver `redactAllStringValuesInObject`). Usamos
  // `Record<string, unknown>` (em vez do tipo `TraceContext` do Sentry, que
  // exige span_id/trace_id) porque só lemos/regravamos `data`.
  const rawContexts = event.contexts as Record<string, unknown> | undefined;
  const rawTrace = rawContexts?.trace as Record<string, unknown> | undefined;
  const rawTraceData = rawTrace?.data as Record<string, unknown> | undefined;
  if (rawTraceData && typeof rawTraceData === "object") {
    event.contexts = {
      ...event.contexts,
      trace: { ...rawTrace, data: redactAllStringValuesInObject(rawTraceData) },
    } as Event["contexts"];
  }

  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map(redactBreadcrumb);
  }

  type RedactableSpan = { description?: string; data?: Record<string, unknown> };
  const rawSpans = (event as unknown as { spans?: unknown }).spans;
  if (Array.isArray(rawSpans)) {
    const redactedSpans = (rawSpans as RedactableSpan[]).map((span) => {
      const redactedSpan: RedactableSpan = { ...span };
      if (typeof redactedSpan.description === "string") {
        redactedSpan.description = redactStudioWebhookTokenInUrl(redactedSpan.description);
      }
      if (redactedSpan.data && typeof redactedSpan.data === "object") {
        // R10-3: mesma correção do trace context — redige toda string do
        // objeto de atributos do span (cobre http.url, url.full, url.path
        // e qualquer outra chave que o SDK vier a adicionar).
        redactedSpan.data = redactAllStringValuesInObject(redactedSpan.data);
      }
      return redactedSpan;
    });
    (event as unknown as { spans?: unknown }).spans = redactedSpans;
  }

  return event;
};
