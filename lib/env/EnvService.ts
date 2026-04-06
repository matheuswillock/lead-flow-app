import { Output } from '../output';
import { IEnvService } from './IEnvService';
import { envSchema, formatValidationErrors, isCriticalEnvVar, type Env } from './validation';

/**
 * Environment Service Implementation
 * 
 * Validates environment variables and provides type-safe access
 */
export class EnvService implements IEnvService {
  private validatedEnv: Env | null = null;
  private validationResult: Output | null = null;

  /**
   * Validate all environment variables using Zod schema
   */
  validate(): Output {
    console.info('[EnvService][validate] Starting environment validation...');

    try {
      // Parse environment variables
      const parsed = envSchema.safeParse(process.env);

      if (!parsed.success) {
        const errorMessages = formatValidationErrors(parsed.error);
        const criticalErrors = parsed.error.issues.filter((issue) =>
          isCriticalEnvVar(issue.path[0] as string)
        );

        console.error('[EnvService][validate] Environment validation failed:');
        errorMessages.forEach((msg) => console.error(`  ${msg}`));

        if (criticalErrors.length > 0) {
          console.error(
            `\n⚠️  ${criticalErrors.length} critical environment variable(s) are missing or invalid!`
          );
          console.error('The application cannot start without these variables.\n');
        }

        this.validationResult = new Output(false, [], errorMessages, null);
        return this.validationResult;
      }

      // Validation successful
      this.validatedEnv = parsed.data;
      this.validationResult = new Output(
        true,
        ['Environment variables validated successfully'],
        [],
        this.validatedEnv
      );

      console.info('[EnvService][validate] ✅ Environment validation successful');
      return this.validationResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during validation';
      console.error('[EnvService][validate] Unexpected error:', errorMessage);

      this.validationResult = new Output(
        false,
        [],
        [`Unexpected validation error: ${errorMessage}`],
        null
      );
      return this.validationResult;
    }
  }

  /**
   * Get validated environment variables
   * Throws error if validation hasn't been performed or failed
   */
  getEnv(): Env {
    if (!this.validatedEnv) {
      throw new Error(
        'Environment variables have not been validated. Call validate() first and ensure it succeeds.'
      );
    }
    return this.validatedEnv;
  }

  /**
   * Check if environment is valid without throwing
   */
  isValid(): boolean {
    return this.validationResult?.isValid ?? false;
  }

  /**
   * Get validation errors if any
   */
  getErrors(): string[] {
    return this.validationResult?.errorMessages ?? [];
  }
}

// Singleton instance
let envServiceInstance: EnvService | null = null;

/**
 * Get the singleton environment service instance
 */
export function getEnvService(): EnvService {
  if (!envServiceInstance) {
    envServiceInstance = new EnvService();
  }
  return envServiceInstance;
}

/**
 * Validate environment variables (convenience function)
 */
export function validateEnv(): Output {
  return getEnvService().validate();
}

/**
 * Get validated environment variables (convenience function)
 */
export function getValidatedEnv(): Env {
  return getEnvService().getEnv();
}
