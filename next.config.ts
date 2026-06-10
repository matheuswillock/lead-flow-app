import type { NextConfig } from "next";
import path from "node:path";
import { validateEnv } from "./lib/env";

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
      "nonzero-rodrick-mentholated.ngrok-free.dev",
    ]
  ),
  serverExternalPackages: ['unzipper'],
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      '@aws-sdk/client-s3': { browser: './empty-module.js', default: './empty-module.js' },
    },
  },
};

export default nextConfig;
