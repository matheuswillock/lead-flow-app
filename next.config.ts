import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";
import path from "node:path";
import { validateEnv } from "./lib/env";
import { getLeadFormEmbedHeaders } from "./lib/security/lead-form-embed-headers";
import {
  getSiteSecurityHeaders,
  getWhatsAppSecurityHeaders,
} from "./lib/security/site-frame-ancestors";

// Validate environment variables at build time
// Skip in CI — secrets are not injected during the build step
if (process.env.CI !== 'true') {
  console.info('\n🔍 Validating environment variables...\n');
  const envValidation = validateEnv();

  if (!envValidation.isValid) {
    console.error('\n❌ Environment validation failed!\n');
    console.error('Please fix the following errors:\n');
    envValidation.errorMessages.forEach((msg) => console.error(`  ${msg}`));
    console.error('\nRefer to .env.example for required variables and their formats.\n');
    process.exit(1);
  }

  console.info('✅ Environment validation passed!\n');
} else {
  console.info('⏭️  [next.config] CI environment detected — skipping build-time env validation.\n');
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: (
    process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [
      "127.0.0.1",
      "localhost",
      "nonzero-rodrick-mentholated.ngrok-free.dev",
    ]
  ),
  serverExternalPackages: ['unzipper'],
  ...(process.env.NODE_ENV !== "production"
    ? { env: { _sentryRewritesTunnelPath: "" } }
    : {}),
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      '@aws-sdk/client-s3': { browser: './empty-module.js', default: './empty-module.js' },
    },
  },
  async headers() {
    return [
      {
        source: "/((?!lead-form).*)",
        headers: getSiteSecurityHeaders(),
      },
      {
        source: "/lead-form/:path*",
        headers: getLeadFormEmbedHeaders(),
      },
      {
        source: "/:supabaseId/whatsapp/:path*",
        headers: getWhatsAppSecurityHeaders(),
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "corretor-studio",

  project: "sentry-camel-flower",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Tunnel only in production — local dev proxy to ingest often fails with ECONNRESET on Windows.
  ...(process.env.NODE_ENV === "production" ? { tunnelRoute: "/monitoring" } : {}),

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
