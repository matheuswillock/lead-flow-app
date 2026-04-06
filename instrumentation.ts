/**
 * Instrumentation Hook
 * 
 * Next.js 15+ instrumentation for runtime initialization.
 * This runs once when the server starts (not on every request).
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironmentOnStartup } = await import('./lib/env/startup-validation');
    validateEnvironmentOnStartup();
  }
}
