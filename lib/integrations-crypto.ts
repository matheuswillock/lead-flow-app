import crypto from "crypto";

const KEY_ENV = "INTEGRATIONS_ENCRYPTION_KEY";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(`${KEY_ENV} nao configurado`);
  }

  const isHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length === 64;
  if (isHex) {
    return Buffer.from(raw, "hex");
  }

  try {
    const base64 = Buffer.from(raw, "base64");
    if (base64.length === 32) {
      return base64;
    }
  } catch {
    // ignore
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptToken(value: string): string {
  if (!value) {
    throw new Error("Token vazio nao pode ser criptografado");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  if (!payload) {
    throw new Error("Payload criptografado vazio");
  }

  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
