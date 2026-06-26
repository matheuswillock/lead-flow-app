// Client-side Sentry initialization (Next.js 15+ canonical entry).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

const sentryEnabled = isSentryEnabled();

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    tracesSampleRate: 1,

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    enableLogs: true,
    sendDefaultPii: true,

    integrations: [
      Sentry.replayIntegration(),
      Sentry.consoleLoggingIntegration({ levels: ["log", "info", "warn", "error", "debug"] }),
    ],
  });
}

export const onRouterTransitionStart = sentryEnabled
  ? Sentry.captureRouterTransitionStart
  : () => undefined;
