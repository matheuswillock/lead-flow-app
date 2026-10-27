import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { decryptStudioWebhookToken, encryptStudioWebhookToken } from "./studioWebhookSecurity";

/**
 * SPEC 10, W10 — `STUDIO_WEBHOOK_TOKEN_SECRET` obrigatória em produção, sem
 * fallback para `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` (reuso de segredo
 * entre domínios de segurança distintos). `lib/webhooks/studioWebhookSecurity.ts:16-37`.
 */
const env = process.env as Record<string, string | undefined>;
const originalEnv = {
  NODE_ENV: env.NODE_ENV,
  STUDIO_WEBHOOK_TOKEN_SECRET: env.STUDIO_WEBHOOK_TOKEN_SECRET,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: env.DATABASE_URL,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

describe("STUDIO_WEBHOOK_TOKEN_SECRET (W10)", () => {
  beforeEach(() => {
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("em produção, SEM STUDIO_WEBHOOK_TOKEN_SECRET mas COM SUPABASE_SERVICE_ROLE_KEY/DATABASE_URL → não cifra (sem fallback)", () => {
    env.NODE_ENV = "production";
    delete env.STUDIO_WEBHOOK_TOKEN_SECRET;
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
    env.DATABASE_URL = "postgresql://user:pass@host:5432/db";

    const result = encryptStudioWebhookToken("um-token-qualquer");

    expect(result).toBeNull();
  });

  it("em produção, COM STUDIO_WEBHOOK_TOKEN_SECRET → cifra normalmente", () => {
    env.NODE_ENV = "production";
    env.STUDIO_WEBHOOK_TOKEN_SECRET = "segredo-proprio-do-webhook";

    const cipher = encryptStudioWebhookToken("um-token-qualquer");

    expect(cipher).not.toBeNull();
    expect(decryptStudioWebhookToken(cipher)).toBe("um-token-qualquer");
  });

  it("fora de produção, sem nenhuma env, ainda cifra (segredo de dev)", () => {
    env.NODE_ENV = "test";
    delete env.STUDIO_WEBHOOK_TOKEN_SECRET;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.DATABASE_URL;

    const result = encryptStudioWebhookToken("um-token-qualquer");

    expect(result).not.toBeNull();
  });
});

describe("Decifragem com leitura dupla (R10-11, revisão Opus, decisão do owner)", () => {
  beforeEach(() => {
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("token cifrado com o fallback antigo (SUPABASE_SERVICE_ROLE_KEY) continua legível depois de configurar STUDIO_WEBHOOK_TOKEN_SECRET", () => {
    // Simula produção ANTES do W10: sem STUDIO_WEBHOOK_TOKEN_SECRET, o
    // fallback antigo cifrava de verdade (comportamento pré-W10,
    // reconstruído aqui só para o teste — o código atual não cifra mais
    // assim, daí "escrevemos" manualmente com a chave derivada do fallback).
    env.NODE_ENV = "production";
    delete env.STUDIO_WEBHOOK_TOKEN_SECRET;
    env.SUPABASE_SERVICE_ROLE_KEY = "segredo-legado-do-service-role";

    // encryptStudioWebhookToken já não usa fallback (W10) — para simular o
    // token histórico, ciframos com a MESMA derivação de chave que o
    // fallback antigo usava (sha256 do SUPABASE_SERVICE_ROLE_KEY), via um
    // segredo temporariamente promovido a STUDIO_WEBHOOK_TOKEN_SECRET só
    // para gerar o cipher de teste.
    env.STUDIO_WEBHOOK_TOKEN_SECRET = env.SUPABASE_SERVICE_ROLE_KEY;
    const legacyCipher = encryptStudioWebhookToken("token-cifrado-em-2026-08");
    expect(legacyCipher).not.toBeNull();

    // Agora simula o estado PÓS-mudança: STUDIO_WEBHOOK_TOKEN_SECRET tem um
    // valor NOVO e DIFERENTE do legado; SUPABASE_SERVICE_ROLE_KEY continua
    // presente (nunca foi removida do ambiente).
    env.STUDIO_WEBHOOK_TOKEN_SECRET = "segredo-novo-dedicado-ao-webhook";

    const decrypted = decryptStudioWebhookToken(legacyCipher);

    expect(decrypted).toBe("token-cifrado-em-2026-08");
  });

  it("token cifrado com o fallback antigo (DATABASE_URL) também continua legível", () => {
    env.NODE_ENV = "production";
    delete env.STUDIO_WEBHOOK_TOKEN_SECRET;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    env.DATABASE_URL = "postgresql://user:pass@legacy-host:5432/db";

    env.STUDIO_WEBHOOK_TOKEN_SECRET = env.DATABASE_URL;
    const legacyCipher = encryptStudioWebhookToken("outro-token-legado");
    expect(legacyCipher).not.toBeNull();

    env.STUDIO_WEBHOOK_TOKEN_SECRET = "segredo-novo-dedicado-ao-webhook";

    expect(decryptStudioWebhookToken(legacyCipher)).toBe("outro-token-legado");
  });

  it("token NOVO nunca é cifrado com a chave antiga — decifrar só com o fallback legado falha", () => {
    env.NODE_ENV = "production";
    env.STUDIO_WEBHOOK_TOKEN_SECRET = "segredo-novo-dedicado-ao-webhook";
    env.SUPABASE_SERVICE_ROLE_KEY = "segredo-legado-do-service-role";

    const newCipher = encryptStudioWebhookToken("token-criado-hoje");
    expect(newCipher).not.toBeNull();

    // Remove o segredo obrigatório para forçar a tentativa a cair só nos
    // candidatos legados — se `encryptStudioWebhookToken` tivesse cifrado
    // com o fallback (não deve), isto decifraria com sucesso.
    delete env.STUDIO_WEBHOOK_TOKEN_SECRET;

    expect(decryptStudioWebhookToken(newCipher)).toBeNull();
  });

  it("sem nenhum segredo (nem novo, nem legado) → não decifra, retorna null (nunca lança)", () => {
    env.NODE_ENV = "production";
    env.STUDIO_WEBHOOK_TOKEN_SECRET = "segredo-novo-dedicado-ao-webhook";
    const cipher = encryptStudioWebhookToken("token-x");

    delete env.STUDIO_WEBHOOK_TOKEN_SECRET;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.DATABASE_URL;

    expect(decryptStudioWebhookToken(cipher)).toBeNull();
  });
});
