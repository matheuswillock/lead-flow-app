import { describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import {
  buildWebhookSigningSecretPreview,
  computeWebhookSignature,
  decryptWebhookSigningSecret,
  encryptWebhookSigningSecret,
  generateWebhookSigningSecret,
  verifyWebhookSignature,
  WEBHOOK_EVENT_VERSION,
  WEBHOOK_EVENT_VERSION_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "./webhookSigningSecurity";

describe("webhookSigningSecurity", () => {
  it("gera segredo com 32 bytes (64 chars hex) de entropia real", () => {
    const secretA = generateWebhookSigningSecret();
    const secretB = generateWebhookSigningSecret();
    expect(secretA).toMatch(/^[0-9a-f]{64}$/);
    expect(secretA).not.toBe(secretB);
  });

  it("T-20.1: a assinatura bate com HMAC-SHA256 de timestamp.corpo — vetor de resposta conhecida", () => {
    // Valor calculado de forma independente (fora deste módulo, via `crypto.createHmac`
    // direto no shell) para um segredo/timestamp/corpo fixos. Um `verifyWebhookSignature`
    // que reusasse `computeWebhookSignature` internamente não pegaria uma fórmula errada
    // (ex.: esquecer o timestamp na concatenação) — R20-1 da revisão. Este teste compara
    // contra um hex literal, sem depender de nenhuma outra função deste arquivo.
    const secret = "test-secret-value";
    const timestamp = "1700000000";
    const rawBody = '{"a":1}';
    const expectedSignature =
      "sha256=ae10842a14a1dabc4a4f21526e300863cc3bc820ef0950f1ee190bc18fd38053";

    expect(computeWebhookSignature(secret, timestamp, rawBody)).toBe(expectedSignature);
  });

  it("T-20.1: a assinatura muda quando só o timestamp muda (prova que ele entra na fórmula)", () => {
    // Controle contra a mutação mais perigosa: remover o timestamp da concatenação e
    // assinar só o corpo. Se isso acontecesse, as duas assinaturas abaixo seriam iguais.
    const secret = "test-secret-value";
    const rawBody = '{"a":1}';

    const signatureAtT1 = computeWebhookSignature(secret, "1700000000", rawBody);
    const signatureAtT2 = computeWebhookSignature(secret, "1700000123", rawBody);

    expect(signatureAtT1).not.toBe(signatureAtT2);
  });

  it("T-20.1: verifyWebhookSignature aceita a assinatura correta calculada de forma independente", () => {
    const secret = generateWebhookSigningSecret();
    const timestamp = "1732000000";
    const rawBody = JSON.stringify({ id: "evt_1", version: WEBHOOK_EVENT_VERSION, data: { a: 1 } });

    // Calculado aqui com createHmac direto (não via computeWebhookSignature), para que
    // este teste não dependa da própria função que está sendo verificada.
    const independentDigest = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const signature = `sha256=${independentDigest}`;

    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);

    const ok = verifyWebhookSignature({
      secret,
      timestamp,
      rawBody,
      signatureHeader: signature,
      now: new Date(Number(timestamp) * 1000),
    });
    expect(ok).toBe(true);
  });

  it("T-20.1 controle negativo: alterar o corpo depois de assinar derruba a verificação", () => {
    const secret = generateWebhookSigningSecret();
    const timestamp = "1732000000";
    const rawBody = JSON.stringify({ id: "evt_1", data: { amount: 100 } });
    const signature = computeWebhookSignature(secret, timestamp, rawBody);

    const tamperedBody = JSON.stringify({ id: "evt_1", data: { amount: 999999 } });

    const ok = verifyWebhookSignature({
      secret,
      timestamp,
      rawBody: tamperedBody,
      signatureHeader: signature,
      now: new Date(Number(timestamp) * 1000),
    });
    expect(ok).toBe(false);
  });

  it("rejeita timestamp mais velho que 5 minutos, mesmo com assinatura correta", () => {
    const secret = generateWebhookSigningSecret();
    const timestamp = "1732000000";
    const rawBody = JSON.stringify({ id: "evt_1" });
    const signature = computeWebhookSignature(secret, timestamp, rawBody);

    const sixMinutesLater = new Date(Number(timestamp) * 1000 + 6 * 60 * 1000);
    const ok = verifyWebhookSignature({
      secret,
      timestamp,
      rawBody,
      signatureHeader: signature,
      now: sixMinutesLater,
    });
    expect(ok).toBe(false);
  });

  it("cifra e decifra o segredo com o mesmo algoritmo do token de entrada (AES-256-GCM)", () => {
    const secret = generateWebhookSigningSecret();
    const cipher = encryptWebhookSigningSecret(secret);
    expect(cipher).toBeTruthy();
    expect(cipher).not.toContain(secret);

    const decrypted = decryptWebhookSigningSecret(cipher);
    expect(decrypted).toBe(secret);
  });

  it("decryptWebhookSigningSecret retorna null para cifra ausente ou inválida", () => {
    expect(decryptWebhookSigningSecret(null)).toBeNull();
    expect(decryptWebhookSigningSecret(undefined)).toBeNull();
    expect(decryptWebhookSigningSecret("lixo-invalido")).toBeNull();
  });

  it("preview nunca expõe o segredo completo", () => {
    const secret = generateWebhookSigningSecret();
    const preview = buildWebhookSigningSecretPreview(secret);
    expect(preview).not.toBe(secret);
    expect(preview.length).toBeLessThan(secret.length);
  });

  it("nomes de header e versão do envelope são os definidos pela SPEC 20", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("X-Corretor-Studio-Signature");
    expect(WEBHOOK_TIMESTAMP_HEADER).toBe("X-Corretor-Studio-Timestamp");
    expect(WEBHOOK_EVENT_VERSION_HEADER).toBe("X-Corretor-Studio-Event-Version");
    expect(WEBHOOK_EVENT_VERSION).toBe(1);
  });
});
