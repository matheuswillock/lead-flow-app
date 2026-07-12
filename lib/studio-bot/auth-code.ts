import bcrypt from "bcryptjs";

const CODE_LENGTH = 6;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_CODE_GENERATIONS_PER_HOUR = 3;
const BCRYPT_COST = 10;

export function generateAuthCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

// bcryptjs (JS puro) em vez de Bun.password: produção roda na Vercel sob Node,
// onde o global Bun não existe.
export async function hashAuthCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_COST);
}

export async function verifyAuthCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function getAuthCodeExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + AUTH_CODE_TTL_MS);
}

export const studioBotAuthLimits = {
  codeLength: CODE_LENGTH,
  ttlMs: AUTH_CODE_TTL_MS,
  maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
  maxCodeGenerationsPerHour: MAX_CODE_GENERATIONS_PER_HOUR,
} as const;
