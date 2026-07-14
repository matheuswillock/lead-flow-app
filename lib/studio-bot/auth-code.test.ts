import { describe, expect, it } from "bun:test";
import {
  generateAuthCode,
  getAuthCodeExpiresAt,
  hashAuthCode,
  studioBotAuthLimits,
  verifyAuthCode,
} from "./auth-code";

describe("generateAuthCode", () => {
  it("gera código numérico com o tamanho configurado", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateAuthCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(studioBotAuthLimits.codeLength);
    }
  });
});

describe("hashAuthCode / verifyAuthCode", () => {
  it("verifica código correto contra o próprio hash (roundtrip)", async () => {
    const code = generateAuthCode();
    const hash = await hashAuthCode(code);
    expect(await verifyAuthCode(code, hash)).toBe(true);
  });

  it("rejeita código incorreto", async () => {
    const hash = await hashAuthCode("123456");
    expect(await verifyAuthCode("654321", hash)).toBe(false);
  });

  it("produz hash no formato bcrypt (compatível com hashes existentes)", async () => {
    const hash = await hashAuthCode("123456");
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it("verifica hash bcrypt pré-existente (retrocompatibilidade)", async () => {
    // Hash de "123456" gerado com bcrypt cost 10 (formato usado em produção)
    const legacyHash = "$2b$10$98DmL5fsIawsXL0hT23r3ez52SGo416PUHL4lQXWU0gvfPmZBU0vy";
    expect(await verifyAuthCode("123456", legacyHash)).toBe(true);
    expect(await verifyAuthCode("000000", legacyHash)).toBe(false);
  });
});

describe("getAuthCodeExpiresAt", () => {
  it("expira exatamente após o TTL configurado", () => {
    const from = new Date("2026-07-10T12:00:00.000Z");
    const expires = getAuthCodeExpiresAt(from);
    expect(expires.getTime() - from.getTime()).toBe(studioBotAuthLimits.ttlMs);
  });
});
