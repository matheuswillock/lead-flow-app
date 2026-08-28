import { createHmac } from "node:crypto";
import {
  E2E_MASTER_EMAIL,
  E2E_MASTER_SUPABASE_ID,
} from "./constants";
import type { E2eJwtClaims } from "./e2e-jwt-verify";

export type { E2eJwtClaims } from "./e2e-jwt-verify";
export { verifyE2eJwt } from "./e2e-jwt-verify";

const JWT_HEADER = { alg: "HS256", typ: "JWT" } as const;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export type SignE2eJwtOptions = {
  nowMs?: number;
  expiresInMs?: number;
  supabaseId?: string;
  email?: string;
};

function readE2eJwtSecret(): string | null {
  const secret = process.env.E2E_JWT_SECRET?.trim() ?? "";
  return secret.length > 0 ? secret : null;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * Assina o JWT E2E. Só roda em Node (Playwright, bun test, seed) —
 * não importar este módulo a partir do `proxy.ts`.
 */
export function signE2eJwt(options: SignE2eJwtOptions = {}): string {
  const secret = readE2eJwtSecret();
  if (!secret) {
    throw new Error("E2E_JWT_SECRET não configurado");
  }

  const nowMs = options.nowMs ?? Date.now();
  const expiresInMs = options.expiresInMs ?? DEFAULT_TTL_MS;
  const iat = Math.floor(nowMs / 1000);
  const payload: E2eJwtClaims = {
    sub: options.supabaseId ?? E2E_MASTER_SUPABASE_ID,
    email: options.email ?? E2E_MASTER_EMAIL,
    iat,
    exp: iat + Math.floor(expiresInMs / 1000),
  };

  const headerB64 = encodeJson(JWT_HEADER);
  const payloadB64 = encodeJson(payload);
  const signature = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signature}`;
}
