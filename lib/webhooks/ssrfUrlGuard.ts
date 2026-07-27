/**
 * Guarda SSRF básica para URLs de webhook outbound.
 * Bloqueia localhost, IPs privados e esquemas não-HTTPS (exceto http em non-production).
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\.0\.0\.0$/,
  /^\[::1\]$/,
  /^::1$/,
  /^metadata\.google\.internal$/i,
  /^169\.254\./,
];

export type SsrfUrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export function assertSafeWebhookTargetUrl(
  rawUrl: string,
  options?: { allowHttpInDev?: boolean }
): SsrfUrlGuardResult {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return { ok: false, reason: "URL de destino é obrigatória" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "URL de destino inválida" };
  }

  // allowHttpInDev=false força HTTPS mesmo em desenvolvimento (útil em testes).
  const allowHttp =
    options?.allowHttpInDev === false
      ? false
      : options?.allowHttpInDev === true || process.env.NODE_ENV !== "production";

  if (parsed.protocol === "https:") {
    // ok
  } else if (parsed.protocol === "http:" && allowHttp) {
    // ok em dev
  } else {
    return { ok: false, reason: "URL de destino deve usar HTTPS" };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return { ok: false, reason: "URL de destino não pode apontar para rede privada" };
    }
  }

  return { ok: true, url: parsed };
}
