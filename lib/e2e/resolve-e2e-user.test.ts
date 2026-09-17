import { afterEach, describe, expect, it } from "bun:test";
import {
  E2E_COOKIE_NAME,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SUPABASE_ID,
} from "@/lib/e2e/constants";
import { signE2eJwt } from "./e2e-jwt";
import { resolveE2eUser, resolveE2eUserFromCookie } from "./resolve-e2e-user";

const SECRET = "e2e-jwt-test-secret-at-least-32-chars";

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "E2E_TEST_MODE",
  "APP_ENV",
  "E2E_JWT_SECRET",
] as const;

const originalEnv: Record<string, string | undefined> = {};

function snapshotEnv() {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    originalEnv[key] = env[key];
  }
}

function restoreEnv() {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete env[key];
    else env[key] = originalEnv[key];
  }
}

function enableTestMode() {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "test";
  delete env.VERCEL_ENV;
  env.E2E_TEST_MODE = "true";
  env.APP_ENV = "test";
  env.E2E_JWT_SECRET = SECRET;
}

snapshotEnv();

describe("resolveE2eUser", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("aceita JWT válido em modo de teste", async () => {
    enableTestMode();
    const token = signE2eJwt();
    const user = await resolveE2eUserFromCookie(token);
    expect(user).toEqual({
      id: E2E_MASTER_SUPABASE_ID,
      email: E2E_MASTER_EMAIL,
      supabaseId: E2E_MASTER_SUPABASE_ID,
    });
    expect(
      await resolveE2eUser((name) => (name === E2E_COOKIE_NAME ? token : null)),
    ).toEqual(user);
  });

  it("aceita JWT válido de usuário E2E customizado", async () => {
    enableTestMode();
    const token = signE2eJwt({
      supabaseId: "11111111-2222-4333-8444-555555555555",
      email: "backoffice.e2e@example.com",
    });

    expect(await resolveE2eUserFromCookie(token)).toEqual({
      id: "11111111-2222-4333-8444-555555555555",
      email: "backoffice.e2e@example.com",
      supabaseId: "11111111-2222-4333-8444-555555555555",
    });
  });

  it("aceita JWT válido com NODE_ENV=production e APP_ENV=test (next start)", async () => {
    enableTestMode();
    const token = signE2eJwt();
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = "production";
    expect(await resolveE2eUserFromCookie(token)).not.toBeNull();
  });

  it("recusa JWT válido quando VERCEL_ENV=production", async () => {
    enableTestMode();
    const token = signE2eJwt();
    const env = process.env as Record<string, string | undefined>;
    env.VERCEL_ENV = "production";
    expect(await resolveE2eUserFromCookie(token)).toBeNull();
  });

  it("recusa quando E2E_TEST_MODE não está ativo", async () => {
    enableTestMode();
    const token = signE2eJwt();
    const env = process.env as Record<string, string | undefined>;
    env.E2E_TEST_MODE = "false";
    expect(await resolveE2eUserFromCookie(token)).toBeNull();
  });

  it("recusa cookie ausente ou JWT inválido mesmo em modo de teste", async () => {
    enableTestMode();
    expect(await resolveE2eUserFromCookie(undefined)).toBeNull();
    expect(await resolveE2eUserFromCookie("not-a-jwt")).toBeNull();
  });
});
