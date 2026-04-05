import crypto from "crypto";
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity";

export type StudioWebhookTokenExpiryModeValue = "hours_24" | "months_6" | "indeterminate";

export type StudioWebhookSqlInspectionResult = {
  suspicious: boolean;
  path?: string;
  rule?: string;
};

const STUDIO_WEBHOOK_TOKEN_CIPHER_VERSION = "v1";
const STUDIO_WEBHOOK_TOKEN_DEV_SECRET = "lead-flow-studio-webhook-dev-secret";

const resolveStudioWebhookTokenSecret = (): string | null => {
  const configuredSecret = process.env.STUDIO_WEBHOOK_TOKEN_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  const serviceRoleSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleSecret) {
    return serviceRoleSecret;
  }

  const databaseSecret = process.env.DATABASE_URL?.trim();
  if (databaseSecret) {
    return databaseSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return STUDIO_WEBHOOK_TOKEN_DEV_SECRET;
  }

  return null;
};

const resolveStudioWebhookTokenCipherKey = (): Buffer | null => {
  const secret = resolveStudioWebhookTokenSecret();
  if (!secret) {
    return null;
  }

  return crypto.createHash("sha256").update(secret).digest();
};

export const generateStudioWebhookToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashStudioWebhookToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const encryptStudioWebhookToken = (token: string): string | null => {
  if (!token) {
    return null;
  }

  const key = resolveStudioWebhookTokenCipherKey();
  if (!key) {
    return null;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    STUDIO_WEBHOOK_TOKEN_CIPHER_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encryptedBuffer.toString("base64url"),
  ].join(".");
};

export const decryptStudioWebhookToken = (tokenCipher: string | null | undefined): string | null => {
  if (!tokenCipher) {
    return null;
  }

  const key = resolveStudioWebhookTokenCipherKey();
  if (!key) {
    return null;
  }

  const [version, ivPart, authTagPart, encryptedPart] = tokenCipher.split(".");
  if (
    version !== STUDIO_WEBHOOK_TOKEN_CIPHER_VERSION ||
    !ivPart ||
    !authTagPart ||
    !encryptedPart
  ) {
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
};

export const safeStudioWebhookTokenEquals = (providedToken: string, expectedTokenHash: string): boolean => {
  if (!providedToken || !expectedTokenHash) {
    return false;
  }

  const providedHash = hashStudioWebhookToken(providedToken);
  const providedBuffer = Buffer.from(providedHash, "hex");
  const expectedBuffer = Buffer.from(expectedTokenHash, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export const buildStudioWebhookTokenPreview = (token: string): string => {
  if (!token) return "";
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
};

export const computeStudioWebhookTokenExpiry = (
  mode: StudioWebhookTokenExpiryModeValue,
  now: Date = new Date()
): Date | null => {
  if (mode === "indeterminate") {
    return null;
  }

  if (mode === "hours_24") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 6);
  return expiry;
};

export const isStudioWebhookTokenExpired = (expiresAt?: Date | null, now: Date = new Date()): boolean => {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
};

const inspectPayloadForSqlInjection = (
  input: unknown,
  currentPath: string
): StudioWebhookSqlInspectionResult => {
  if (typeof input === "string") {
    const detection = detectSqlInjection(input);
    if (detection.suspicious) {
      return {
        suspicious: true,
        path: currentPath,
        rule: detection.rule,
      };
    }
    return { suspicious: false };
  }

  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index += 1) {
      const nestedPath = `${currentPath}[${index}]`;
      const nestedResult = inspectPayloadForSqlInjection(input[index], nestedPath);
      if (nestedResult.suspicious) {
        return nestedResult;
      }
    }
    return { suspicious: false };
  }

  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const nestedPath = currentPath ? `${currentPath}.${key}` : key;
      const nestedResult = inspectPayloadForSqlInjection(value, nestedPath);
      if (nestedResult.suspicious) {
        return nestedResult;
      }
    }
  }

  return { suspicious: false };
};

export const detectStudioWebhookPayloadSqlInjection = (
  payload: unknown
): StudioWebhookSqlInspectionResult => {
  return inspectPayloadForSqlInjection(payload, "payload");
};

export const sanitizeStudioWebhookEndpointForLogs = (pathname: string, teamId: string): string => {
  const normalizedPath = pathname.split("?")[0];
  const tokenRoutePrefix = `/api/webhooks/studio/${teamId}/`;

  if (normalizedPath.startsWith(tokenRoutePrefix)) {
    return `${tokenRoutePrefix}[token]`;
  }

  return normalizedPath;
};
