import type { NextConfig } from "next";
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
  // Gera pasta .next/standalone com tudo necessário para rodar em VPS sem node_modules completo
  output: 'standalone',

  // Configurações para reduzir warnings
  serverExternalPackages: ['@supabase/supabase-js'],
  
  // Configurações para reduzir warnings de webpack
  webpack: (config, { isServer, dev }) => {
    // Configurações específicas para reduzir warnings
    if (!isServer && !dev) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    return config;
  }
};

export default nextConfig;
