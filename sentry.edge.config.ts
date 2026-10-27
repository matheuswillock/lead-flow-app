// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
  // do envio. Precisa cobrir o edge também (`sentry.edge.config.ts`).
  beforeSend: (event) => applyWebhookTokenRedaction(event),
  beforeSendTransaction: (event) => applyWebhookTokenRedaction(event),

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["log", "info", "warn", "error", "debug"] }),
  ],
});
