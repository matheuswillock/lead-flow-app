import crypto from "node:crypto";

const VERSION = "v1";

function encryptionKey(): Buffer {
  const source = process.env.ENCRYPTION_KEY?.trim();
  if (!source) {
    throw new Error("ENCRYPTION_KEY é obrigatória para Host Ops da Bethânia");
  }
  return /^[0-9a-f]{64}$/i.test(source)
    ? Buffer.from(source, "hex")
    : crypto.createHash("sha256").update(source).digest();
}

export function encryptHostEnvMap(env: Record<string, string>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(env), "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptHostEnvMap(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== VERSION || !iv || !tag || !encrypted) return {};
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plain.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(parsed)) {
      if (typeof raw === "string") out[key] = raw;
    }
    return out;
  } catch {
    return {};
  }
}

export function hashAgentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateAgentToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function verifyAgentToken(token: string, hash: string | null | undefined): boolean {
  if (!hash || !token) return false;
  const actual = hashAgentToken(token);
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
