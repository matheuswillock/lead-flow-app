import { Output } from '../output';
import { Env } from './validation';

/**
 * Environment Service Interface
 * 
 * Defines the contract for environment variable validation and access
 */
export interface IEnvService {
  /**
   * Validate all environment variables
   * @returns Output with validation result
   */
  validate(): Output;

  /**
   * Get validated environment variables
   * Throws error if validation hasn't been performed or failed
   * @returns Typed environment variables
   */
  getEnv(): Env;

  /**
   * Check if environment is valid without throwing
   * @returns boolean indicating if environment is valid
   */
  isValid(): boolean;
}
