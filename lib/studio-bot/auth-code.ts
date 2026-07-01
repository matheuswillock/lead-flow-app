const CODE_LENGTH = 6;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_CODE_GENERATIONS_PER_HOUR = 3;

export function generateAuthCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
}

export async function hashAuthCode(code: string): Promise<string> {
  return Bun.password.hash(code, { algorithm: "bcrypt", cost: 10 });
}

export async function verifyAuthCode(code: string, hash: string): Promise<boolean> {
  return Bun.password.verify(code, hash);
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
