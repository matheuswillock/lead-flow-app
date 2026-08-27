import {
  E2E_MASTER_EMAIL,
  E2E_MASTER_SUPABASE_ID,
} from "./constants";

export type E2eJwtClaims = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

function fromBase64Url(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const binary = atob(`${padded}${"=".repeat(padLength)}`);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJson<T>(encoded: string): T | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function signaturesMatch(expected: Uint8Array, providedB64: string): boolean {
  try {
    const provided = fromBase64Url(providedB64);
    if (provided.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) {
      diff |= expected[i]! ^ provided[i]!;
    }
    return diff === 0;
  } catch {
    return false;
  }
}

async function hmacSha256(secret: string, input: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(input));
  return new Uint8Array(signature);
}

/**
 * Verifica o JWT E2E com Web Crypto (Edge + Node). Sem `node:crypto`
 * para o `proxy.ts` conseguir autenticar no runtime Edge.
 */
export async function verifyE2eJwt(token: string): Promise<E2eJwtClaims | null> {
  const secret = process.env.E2E_JWT_SECRET?.trim() ?? "";
  if (!secret) {
    console.error("[E2E] E2E_JWT_SECRET ausente");
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  const expected = await hmacSha256(secret, `${headerB64}.${payloadB64}`);
  if (!signaturesMatch(expected, signatureB64)) return null;

  const header = decodeJson<{ alg?: unknown; typ?: unknown }>(headerB64);
  if (!header || header.alg !== "HS256") return null;

  const payload = decodeJson<Partial<E2eJwtClaims>>(payloadB64);
  if (!payload) return null;
  if (payload.sub !== E2E_MASTER_SUPABASE_ID) return null;
  if (payload.email !== E2E_MASTER_EMAIL) return null;
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) return null;

  return {
    sub: payload.sub,
    email: payload.email,
    iat: payload.iat,
    exp: payload.exp,
  };
}
