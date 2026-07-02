import { createHash, randomBytes } from "node:crypto";

export const CONTRACT_SHARE_TTL_MS = 24 * 60 * 60 * 1000;

export function generateContractShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashContractShareToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function getContractShareExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + CONTRACT_SHARE_TTL_MS);
}

export function isContractShareExpired(expiresAt?: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}
