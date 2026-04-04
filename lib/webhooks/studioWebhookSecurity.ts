import crypto from "crypto";
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity";

export type StudioWebhookTokenExpiryModeValue = "hours_24" | "months_6" | "indeterminate";

export type StudioWebhookSqlInspectionResult = {
  suspicious: boolean;
  path?: string;
  rule?: string;
};

export const generateStudioWebhookToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashStudioWebhookToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
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
