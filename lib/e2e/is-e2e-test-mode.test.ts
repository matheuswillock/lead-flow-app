import { afterEach, describe, expect, it } from "bun:test";
import { isE2eTestMode } from "./is-e2e-test-mode";

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL_ENV",
  "E2E_TEST_MODE",
  "APP_ENV",
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

function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  const env = process.env as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

snapshotEnv();

describe("isE2eTestMode", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("ativa somente com E2E_TEST_MODE=true e APP_ENV=test fora de Vercel production", () => {
    setEnv({
      NODE_ENV: "test",
      VERCEL_ENV: undefined,
      E2E_TEST_MODE: "true",
      APP_ENV: "test",
    });
    expect(isE2eTestMode()).toBe(true);
  });

  it("aceita NODE_ENV=production quando APP_ENV=test (next start no CI)", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_ENV: undefined,
      E2E_TEST_MODE: "true",
      APP_ENV: "test",
    });
    expect(isE2eTestMode()).toBe(true);
  });

  it("recusa quando E2E_TEST_MODE não é true", () => {
    setEnv({
      NODE_ENV: "test",
      VERCEL_ENV: undefined,
      E2E_TEST_MODE: "false",
      APP_ENV: "test",
    });
    expect(isE2eTestMode()).toBe(false);
  });

  it("recusa quando APP_ENV não é test", () => {
    setEnv({
      NODE_ENV: "test",
      VERCEL_ENV: undefined,
      E2E_TEST_MODE: "true",
      APP_ENV: "development",
    });
    expect(isE2eTestMode()).toBe(false);
  });

  it("recusa quando VERCEL_ENV=production", () => {
    setEnv({
      NODE_ENV: "test",
      VERCEL_ENV: "production",
      E2E_TEST_MODE: "true",
      APP_ENV: "test",
    });
    expect(isE2eTestMode()).toBe(false);
  });
});
