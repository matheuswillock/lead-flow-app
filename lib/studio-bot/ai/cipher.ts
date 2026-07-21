import crypto from "crypto";

const VERSION = "v1";

function key(): Buffer {
  const source = process.env.ENCRYPTION_KEY?.trim();
  if (!source) throw new Error("ENCRYPTION_KEY é obrigatória para propostas da Bethânia");
  return /^[0-9a-f]{64}$/i.test(source)
    ? Buffer.from(source, "hex")
    : crypto.createHash("sha256").update(source).digest();
}

export function encryptBethaniaAiProposalParameters(parameters: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(parameters), "utf8"),
    cipher.final(),
  ]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptBethaniaAiProposalParameters<T>(value: string): T | null {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== VERSION || !iv || !tag || !encrypted) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  } catch {
    return null;
  }
}
