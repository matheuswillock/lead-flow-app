/**
 * Environment Module
 * 
 * Centralized environment variable validation and access
 * 
 * Usage:
 * ```typescript
 * import { validateEnv, getValidatedEnv } from '@/lib/env';
 * 
 * // At build time or startup
 * const result = validateEnv();
 * if (!result.isValid) {
 *   console.error('Environment validation failed:', result.errorMessages);
 *   process.exit(1);
 * }
 * 
 * // In your code
 * const env = getValidatedEnv();
 * console.log(env.NEXT_PUBLIC_APP_URL); // Type-safe!
 * ```
 */

export { EnvService, getEnvService, validateEnv, getValidatedEnv } from './EnvService';
export type { IEnvService } from './IEnvService';
export type { Env } from './validation';
export { envSchema, formatValidationErrors, isCriticalEnvVar, CRITICAL_ENV_VARS } from './validation';
