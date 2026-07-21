import crypto from "crypto";

const DIALER_SECRET_CIPHER_VERSION = "v1";
const DIALER_SECRET_DEV_KEY = "lead-flow-dialer-dev-secret";

function resolveDialerEncryptionKey(): Buffer | null {
  const configuredKey = process.env.DIALER_ENCRYPTION_KEY?.trim();
  if (configuredKey) {
    return crypto.createHash("sha256").update(configuredKey).digest();
  }

  if (process.env.NODE_ENV !== "production") {
    return crypto.createHash("sha256").update(DIALER_SECRET_DEV_KEY).digest();
  }

  return null;
}

export function encryptDialerSecret(plainText: string): string | null {
  if (!plainText) {
    return null;
  }

  const key = resolveDialerEncryptionKey();
  if (!key) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    DIALER_SECRET_CIPHER_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encryptedBuffer.toString("base64url"),
  ].join(".");
}

export function decryptDialerSecret(cipherText: string | null | undefined): string | null {
  if (!cipherText) {
    return null;
  }

  const key = resolveDialerEncryptionKey();
  if (!key) {
    return null;
  }

  const [version, ivPart, authTagPart, encryptedPart] = cipherText.split(".");
  if (version !== DIALER_SECRET_CIPHER_VERSION || !ivPart || !authTagPart || !encryptedPart) {
    return null;
  }

  try {
    const iv = Buffer.from(ivPart, "base64url");
    const authTag = Buffer.from(authTagPart, "base64url");
    const encryptedBuffer = Buffer.from(encryptedPart, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decryptedBuffer.toString("utf8");
  } catch {
    return null;
  }
}
