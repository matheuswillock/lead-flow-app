import crypto from "crypto";
import {
  buildTeamWebhookTokenPreview,
  decryptTeamWebhookToken,
  encryptTeamWebhookToken,
} from "@/lib/webhooks/teamWebhookSecurity";

/**
 * Assinatura HMAC do webhook de saída (SPEC 20, DA1).
 *
 * O segredo é gerado com `randomBytes(32)` e cifrado com o mesmo algoritmo
 * AES-256-GCM do token de webhook de entrada (`studioWebhookSecurity.ts`,
 * reexportado por `teamWebhookSecurity.ts`) — não é um novo domínio de
 * segredo, apenas reaproveita a cifra já auditada.
 */

export const WEBHOOK_SIGNATURE_HEADER = "X-Corretor-Studio-Signature";
export const WEBHOOK_TIMESTAMP_HEADER = "X-Corretor-Studio-Timestamp";
export const WEBHOOK_EVENT_VERSION_HEADER = "X-Corretor-Studio-Event-Version";

/** Versão do envelope de evento de saída (DA2). Único valor por decisão do owner em 21/09. */
export const WEBHOOK_EVENT_VERSION = 1;

/** O destino deve rejeitar assinaturas com timestamp mais velho que isto. */
export const WEBHOOK_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export function generateWebhookSigningSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function encryptWebhookSigningSecret(secret: string): string | null {
  return encryptTeamWebhookToken(secret);
}

export function decryptWebhookSigningSecret(
  signingSecretCipher: string | null | undefined
): string | null {
  return decryptTeamWebhookToken(signingSecretCipher);
}

export function buildWebhookSigningSecretPreview(secret: string): string {
  return buildTeamWebhookTokenPreview(secret);
}

/** `sha256=<hmac>`, calculado sobre `timestamp + "." + corpo bruto` (R20.1). */
export function computeWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string
): string {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `sha256=${digest}`;
}

export type VerifyWebhookSignatureArgs = {
  secret: string;
  timestamp: string;
  rawBody: string;
  signatureHeader: string;
  now?: Date;
  maxAgeMs?: number;
};

/**
 * Verificação de referência (usada nos testes e no guia da tela). Confere:
 * 1. o timestamp não é mais velho que `maxAgeMs` (regra dos 5 minutos);
 * 2. a assinatura bate via comparação timing-safe.
 */
export function verifyWebhookSignature(args: VerifyWebhookSignatureArgs): boolean {
  const { secret, timestamp, rawBody, signatureHeader, now = new Date(), maxAgeMs = WEBHOOK_SIGNATURE_MAX_AGE_MS } =
    args;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) {
    return false;
  }
  if (Math.abs(now.getTime() - timestampMs) > maxAgeMs) {
    return false;
  }

  const expected = computeWebhookSignature(secret, timestamp, rawBody);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
