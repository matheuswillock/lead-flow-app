/** Sentry is production-only; local dev avoids tunnel/proxy noise and ECONNRESET to ingest. */
export function isSentryEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}
