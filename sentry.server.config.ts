// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";
import { applyWebhookTokenRedaction } from "@/lib/sentry/webhookTokenRedaction";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isSentryEnabled(),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // SPEC 10, A-E5 (DA5, V7): token do webhook de entrada não pode aparecer
  // em evento do Sentry — reescreve a URL, os spans e os breadcrumbs antes
  // do envio. Não depende de desligar sendDefaultPii para o app inteiro.
  beforeSend: (event) => applyWebhookTokenRedaction(event),
  beforeSendTransaction: (event) => applyWebhookTokenRedaction(event),

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["log", "info", "warn", "error", "debug"] }),
  ],
});
