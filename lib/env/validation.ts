import { z } from 'zod';

/**
 * Environment Variable Validation Schema
 * 
 * Defines all required environment variables with their expected formats.
 * Provides clear error messages when variables are missing or incorrectly formatted.
 */

// Helper validators
const urlSchema = z.string().url({
  message: 'Must be a valid URL starting with http:// or https://',
});

const nonEmptyString = z.string().min(1, {
  message: 'Cannot be empty',
});

const emailSchema = z.string().email({
  message: 'Must be a valid email address',
});

const hexKeySchema = z
  .string()
  .length(64, {
    message: 'Must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32',
  })
  .regex(/^[0-9a-f]{64}$/i, {
    message: 'Must contain only hexadecimal characters (0-9, a-f)',
  });

const postgresUrlSchema = z
  .string()
  .startsWith('postgresql://', {
    message: 'Must be a valid PostgreSQL connection string starting with postgresql://',
  });

const asaasApiKeySchema = z
  .string()
  .startsWith('aact_', {
    message: 'Must start with "aact_" (Asaas API key format)',
  })
  .min(10, {
    message: 'Must be at least 10 characters long',
  });

const asaasEnvSchema = z.enum(['sandbox', 'production'], {
  error: 'Must be either "sandbox" or "production"',
});

const booleanStringSchema = z
  .string()
  .refine((val) => val === 'true' || val === 'false', {
    message: 'Must be either "true" or "false"',
  })
  .transform((val) => val === 'true');

// Main environment variables schema
export const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: urlSchema.describe('Supabase project URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmptyString.describe('Supabase anonymous key'),
  SUPABASE_SERVICE_ROLE_KEY: nonEmptyString.describe('Supabase service role key'),
  SUPABASE_LEAD_ATTACHMENTS_BUCKET: nonEmptyString.describe('Supabase bucket name for lead attachments'),
  SUPABASE_PROFILE_ICONS_BUCKET: nonEmptyString.describe('Supabase bucket name for profile icons'),

  // Database PostgreSQL
  POSTGRES_USER: nonEmptyString.describe('PostgreSQL username'),
  POSTGRES_PASSWORD: nonEmptyString.describe('PostgreSQL password'),
  POSTGRES_HOST: nonEmptyString.describe('PostgreSQL host'),
  POSTGRES_PORT: z
    .string()
    .regex(/^\d+$/, { message: 'Must be a valid port number' })
    .transform(Number)
    .pipe(z.number().min(1).max(65535))
    .describe('PostgreSQL port'),
  POSTGRES_DB: nonEmptyString.describe('PostgreSQL database name'),
  DATABASE_URL: postgresUrlSchema.describe('PostgreSQL connection URL (pooled)'),
  DIRECT_URL: postgresUrlSchema.describe('PostgreSQL direct connection URL'),

  // Resend (Email)
  RESEND_API_KEY: nonEmptyString
    .startsWith('re_', { message: 'Must start with "re_" (Resend API key format)' })
    .describe('Resend API key for email sending'),
  EMAIL_TEST_MODE: booleanStringSchema.describe('Enable email test mode'),
  RESEND_OWNER_EMAIL: emailSchema.describe('Owner email address'),
  SUPPORT_EMAIL: emailSchema.describe('Support email address'),

  // Asaas Payment Gateway
  ASAAS_API_KEY: asaasApiKeySchema.describe('Asaas API key'),
  ASAAS_WALLET_ID: nonEmptyString.describe('Asaas wallet ID'),
  ASAAS_WEBHOOK_TOKEN: nonEmptyString.describe('Asaas webhook verification token'),
  ASAAS_ENV: asaasEnvSchema.describe('Asaas environment'),
  ASAAS_URL: urlSchema.describe('Asaas API base URL'),
  ASAAS_URL_sandbox: urlSchema.describe('Asaas sandbox API base URL'),

  // App URLs
  NEXT_PUBLIC_APP_URL: urlSchema.describe('Public app URL'),
  NEXT_PUBLIC_API_URL: z.string().optional().describe('Public API URL (optional)'),
  NEXT_API_BASE_URL: nonEmptyString.describe('API base path'),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: urlSchema.describe('Sentry DSN for browser and server SDKs'),
  // Build-time only — provided via .env.sentry-build-plugin; not needed at runtime
  SENTRY_AUTH_TOKEN: nonEmptyString.optional().describe('Sentry auth token for source map upload'),
  // Hardcoded in next.config.ts; kept here for CI/Vercel overrides
  SENTRY_ORG: nonEmptyString.optional().describe('Sentry organization slug'),
  SENTRY_PROJECT: nonEmptyString.optional().describe('Sentry project slug'),
  SENTRY_PUBLIC_KEY: nonEmptyString.optional().describe('Sentry public key (extractable from DSN)'),
  // Vercel-injected integrations — not available in local dev
  SENTRY_OTLP_TRACES_URL: urlSchema.optional().describe('Sentry OTLP traces endpoint'),
  SENTRY_VERCEL_LOG_DRAIN_URL: urlSchema.optional().describe('Sentry Vercel log drain URL'),

  // Encryption keys
  ENCRYPTION_KEY: hexKeySchema.describe('Server-side encryption key'),
  NEXT_PUBLIC_ENCRYPTION_KEY: hexKeySchema.describe('Client-side encryption key'),

  // Integrations (Meta / WhatsApp)
  INTEGRATIONS_ENCRYPTION_KEY: nonEmptyString
    .min(32, {
      message: 'Must be at least 32 characters (use 32 bytes key - 64 hex chars or 44 base64 chars)',
    })
    .describe('Encryption key for integrations'),
  META_APP_SECRET: z.string().optional().describe('Meta app secret (optional)'),
  META_ACCESS_TOKEN: z.string().optional().describe('Meta access token (optional)'),
  META_VERIFY_TOKEN: nonEmptyString.describe('Meta webhook verification token'),

  // Google OAuth (Calendar)
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().describe('Google OAuth client ID (optional)'),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().describe('Google OAuth client secret (optional)'),

  // Web Push (optional — notifications still work in-app without these)
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional().describe('VAPID public key for Web Push'),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().optional().describe('VAPID private key for Web Push'),
  WEB_PUSH_VAPID_SUBJECT: z.string().optional().describe('VAPID subject (mailto: or https:)'),
  NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional().describe('VAPID public key exposed to client'),
});

// Infer the type from the schema
export type Env = z.infer<typeof envSchema>;

// Critical environment variables that must be present for the app to function
export const CRITICAL_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'ENCRYPTION_KEY',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

/**
 * Format validation errors for human-readable output
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.issues.map((issue) => {
    const path = issue.path.join('.');
    const message = issue.message;
    return `❌ ${path}: ${message}`;
  });
}

/**
 * Check if a variable is critical for app functionality
 */
export function isCriticalEnvVar(varName: string): boolean {
  return CRITICAL_ENV_VARS.includes(varName as never);
}
