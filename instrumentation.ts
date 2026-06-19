/**
 * Instrumentation Hook
 *
 * Next.js 15+ instrumentation for runtime initialization.
 * This runs once when the server starts (not on every request).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    const { validateEnvironmentOnStartup } = await import("./lib/env/startup-validation");
    validateEnvironmentOnStartup();

    return;
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
