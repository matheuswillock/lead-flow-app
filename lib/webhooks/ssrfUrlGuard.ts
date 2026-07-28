/**
 * Guarda SSRF para URLs de webhook outbound.
 * Bloqueia localhost, IPs privados (literal e via DNS) e esquemas não-HTTPS
 * (exceto http em non-production). A entrega deve usar o IP validado (pin)
 * para reduzir DNS rebinding.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";

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
  | { ok: true; url: URL; pinnedAddress?: string; pinnedFamily?: 4 | 6 }
  | { ok: false; reason: string };

export function isPrivateIpAddress(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, "").toLowerCase();

  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map((part) => Number(part));
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  if (net.isIPv6(normalized)) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
    if (normalized.startsWith("fe80")) return true; // link-local
    // IPv4-mapped IPv6 (:ffff:x.x.x.x)
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (mapped?.[1]) return isPrivateIpAddress(mapped[1]);
    return false;
  }

  return false;
}

function assertLiteralHostnameSafe(hostname: string): string | null {
  for (const pattern of PRIVATE_HOST_PATTERNS) {
    if (pattern.test(hostname)) {
      return "URL de destino não pode apontar para rede privada";
    }
  }
  if (net.isIP(hostname) && isPrivateIpAddress(hostname)) {
    return "URL de destino não pode apontar para rede privada";
  }
  return null;
}

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
  const literalError = assertLiteralHostnameSafe(hostname);
  if (literalError) {
    return { ok: false, reason: literalError };
  }

  if (net.isIP(hostname)) {
    return {
      ok: true,
      url: parsed,
      pinnedAddress: hostname,
      pinnedFamily: net.isIPv6(hostname) ? 6 : 4,
    };
  }

  return { ok: true, url: parsed };
}

/**
 * Valida URL + resolve DNS e rejeita qualquer registro A/AAAA privado.
 * Preferir esta variante em create/update/delivery.
 */
export async function assertSafeWebhookTargetUrlResolved(
  rawUrl: string,
  options?: { allowHttpInDev?: boolean }
): Promise<SsrfUrlGuardResult> {
  const base = assertSafeWebhookTargetUrl(rawUrl, options);
  if (!base.ok) return base;

  if (base.pinnedAddress) {
    return base;
  }

  const hostname = base.url.hostname.replace(/^\[|\]$/g, "");

  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: "Não foi possível resolver o host de destino" };
  }

  if (records.length === 0) {
    return { ok: false, reason: "Host de destino sem registros DNS" };
  }

  for (const record of records) {
    if (isPrivateIpAddress(record.address)) {
      return {
        ok: false,
        reason: "URL de destino resolve para endereço de rede privada",
      };
    }
  }

  const primary = records[0];
  return {
    ok: true,
    url: base.url,
    pinnedAddress: primary.address,
    pinnedFamily: primary.family === 6 ? 6 : 4,
  };
}
