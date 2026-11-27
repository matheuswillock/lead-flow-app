import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type BethaniaDnsResult = { address: string; family: number };
export type BethaniaHostResolver = (hostname: string) => Promise<BethaniaDnsResult[]>;

async function resolveAll(hostname: string): Promise<BethaniaDnsResult[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

export function isPublicBethaniaSenderAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c, d] = address.split(".").map(Number);
    if ([a, b, c, d].some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      (a === 255 && b === 255 && c === 255 && d === 255)
    );
  }
  if (version !== 6) return false;

  const parts = expandIpv6(address);
  if (!parts) return false;
  const first = Number.parseInt(parts[0]!, 16);
  const second = Number.parseInt(parts[1]!, 16);
  // Permit only global-unicast 2000::/3; exclude documentation and transition ranges.
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (second === 0 || second === 2 || second === 0x0db8));
}

function expandIpv6(address: string): string[] | null {
  const normalized = address.toLowerCase();
  if (normalized.includes(".")) return null;
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const parts = [...left, ...Array(missing).fill("0"), ...right];
  return parts.length === 8 && parts.every((part) => /^[0-9a-f]{1,4}$/.test(part)) ? parts : null;
}

export async function assertPublicBethaniaSenderHost(
  value: string,
  resolver: BethaniaHostResolver = resolveAll,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Promise<void> {
  if (nodeEnv !== "production") return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL do conector não permitida");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(hostname)) {
    if (!isPublicBethaniaSenderAddress(hostname)) throw new Error("URL do conector não permitida");
    return;
  }
  let answers: BethaniaDnsResult[];
  try {
    answers = await resolver(hostname);
  } catch {
    throw new Error("URL do conector não permitida");
  }
  if (answers.length === 0 || answers.some(({ address }) => !isPublicBethaniaSenderAddress(address))) {
    throw new Error("URL do conector não permitida");
  }
}
