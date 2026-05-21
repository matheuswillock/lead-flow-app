import { createHash, randomBytes } from "node:crypto";

const TOKEN_PREFIX = "cs_live_";

export function generateMcpToken(): { token: string; tokenHash: string; tokenPreview: string } {
  const raw = randomBytes(32).toString("hex");
  const token = `${TOKEN_PREFIX}${raw}`;
  const tokenHash = hashMcpToken(token);
  const tokenPreview = `${TOKEN_PREFIX}${raw.slice(0, 8)}...`;
  return { token, tokenHash, tokenPreview };
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
