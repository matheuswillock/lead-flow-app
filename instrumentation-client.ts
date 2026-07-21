// Client-side Sentry initialization (Next.js 15+ canonical entry).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/sentry/is-sentry-enabled";

const sentryEnabled = isSentryEnabled();

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Amostragem de traces reduzida: 100% gerava volume alto de envelopes
    // (e 429 no túnel /monitoring) sem ganho proporcional de sinal.
    tracesSampleRate: 0.1,

    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,

    enableLogs: true,
    sendDefaultPii: true,

    integrations: [
      // Apenas warn/error: log/info/debug geravam ruído e tráfego constante.
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
  });

  // Replay carregado de forma lazy para tirar ~90KB do bundle inicial.
  void Sentry.lazyLoadIntegration("replayIntegration")
    .then((replayIntegration) => {
      Sentry.addIntegration(replayIntegration());
    })
    .catch(() => {
      // Falha ao carregar o replay não deve impactar a aplicação.
    });
}

export const onRouterTransitionStart = sentryEnabled
  ? Sentry.captureRouterTransitionStart
  : () => undefined;
