import { afterEach, describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  E2E_MASTER_EMAIL,
  E2E_MASTER_SUPABASE_ID,
} from "@/lib/e2e/constants";
import { signE2eJwt, verifyE2eJwt } from "./e2e-jwt";

const SECRET = "e2e-jwt-test-secret-at-least-32-chars";
const originalSecret = process.env.E2E_JWT_SECRET;

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function craftJwt(payload: unknown, secret = SECRET, header: unknown = { alg: "HS256", typ: "JWT" }) {
  const headerB64 = encodeJson(header);
  const payloadB64 = encodeJson(payload);
  const signature = createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe("e2e-jwt", () => {
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.E2E_JWT_SECRET;
    else process.env.E2E_JWT_SECRET = originalSecret;
  });

  it("assina e verifica um JWT HS256 do usuário master", async () => {
    process.env.E2E_JWT_SECRET = SECRET;
    const token = signE2eJwt();
    const claims = await verifyE2eJwt(token);
    expect(claims).not.toBeNull();
    expect(claims?.sub).toBe(E2E_MASTER_SUPABASE_ID);
    expect(claims?.email).toBe(E2E_MASTER_EMAIL);
  });

  it("recusa token adulterado", async () => {
    process.env.E2E_JWT_SECRET = SECRET;
    const token = signE2eJwt();
    const [header, payload, signature] = token.split(".");
    expect(await verifyE2eJwt(`${header}.${payload}.${signature}aa`)).toBeNull();
  });

  it("recusa assinatura com secret errado", async () => {
    process.env.E2E_JWT_SECRET = SECRET;
    const token = signE2eJwt();
    process.env.E2E_JWT_SECRET = "outro-secret-totalmente-diferente-32";
    expect(await verifyE2eJwt(token)).toBeNull();
  });

  it("recusa JWT expirado", async () => {
    process.env.E2E_JWT_SECRET = SECRET;
    const token = signE2eJwt({
      nowMs: Date.now() - 10_000,
      expiresInMs: 1_000,
    });
    expect(await verifyE2eJwt(token)).toBeNull();
  });

  it("recusa alg diferente de HS256", async () => {
    process.env.E2E_JWT_SECRET = SECRET;
    const now = Math.floor(Date.now() / 1000);
    const token = craftJwt(
      {
        sub: E2E_MASTER_SUPABASE_ID,
        email: E2E_MASTER_EMAIL,
        iat: now,
        exp: now + 3600,
      },
      SECRET,
      { alg: "none", typ: "JWT" },
    );
    expect(await verifyE2eJwt(token)).toBeNull();
  });

  it("recusa claims que não são do usuário master", async () => {
    process.env.E2E_JWT_SECRET = SECRET;
    const now = Math.floor(Date.now() / 1000);
    const token = craftJwt({
      sub: "00000000-0000-4000-8000-000000000000",
      email: "other@example.com",
      iat: now,
      exp: now + 3600,
    });
    expect(await verifyE2eJwt(token)).toBeNull();
  });

  it("lança ao assinar sem E2E_JWT_SECRET", () => {
    delete process.env.E2E_JWT_SECRET;
    expect(() => signE2eJwt()).toThrow("E2E_JWT_SECRET");
  });
});
