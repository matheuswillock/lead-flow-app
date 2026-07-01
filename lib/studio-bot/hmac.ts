import crypto from "crypto";

const SIGNATURE_PREFIX = "sha256=";

export function signStudioBotPayload(body: string, secret: string): string {
  const hash = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `${SIGNATURE_PREFIX}${hash}`;
}

export function verifyStudioBotSignature(
  body: string,
  signature: string | null | undefined,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const signatureHash = signature.startsWith(SIGNATURE_PREFIX)
    ? signature.slice(SIGNATURE_PREFIX.length)
    : signature;

  const expectedHash = crypto.createHmac("sha256", secret).update(body).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, "hex"),
      Buffer.from(expectedHash, "hex")
    );
  } catch {
    return false;
  }
}

export function resolveStudioBotWebhookSecret(): string | null {
  return process.env.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET?.trim() || null;
}
