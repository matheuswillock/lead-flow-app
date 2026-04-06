import { validateEnv } from './index';

/**
 * Startup Environment Validation
 * 
 * Validates environment variables when the server starts.
 * Called by instrumentation.ts hook.
 */
export function validateEnvironmentOnStartup(): void {
  // Skip hard validation during CI build — the server doesn't start in that context
  if (process.env.CI === 'true') {
    console.info('⏭️  [Startup] CI environment detected — skipping startup env validation.\n');
    return;
  }

  console.info('\n🚀 [Startup] Validating environment variables...\n');

  const result = validateEnv();

  if (!result.isValid) {
    console.error('\n❌ [Startup] Environment validation failed!\n');
    console.error('The application cannot start with invalid environment variables.\n');
    console.error('Errors:\n');
    result.errorMessages.forEach((msg) => console.error(`  ${msg}`));
    console.error('\nPlease check your .env file and ensure all required variables are set correctly.');
    console.error('Refer to .env.example for the expected format of each variable.\n');

    // Exit the process - the app should not start with invalid environment
    process.exit(1);
  }

  console.info('✅ [Startup] Environment validation successful!\n');
}
