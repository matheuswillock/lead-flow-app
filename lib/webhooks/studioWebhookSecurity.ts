import crypto from "crypto";
import { addMonths } from "date-fns";
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity";

export type StudioWebhookTokenExpiryModeValue = "hours_24" | "months_6" | "indeterminate";

export type StudioWebhookSqlInspectionResult = {
  suspicious: boolean;
  path?: string;
  rule?: string;
};

const STUDIO_WEBHOOK_TOKEN_CIPHER_VERSION = "v1";
const STUDIO_WEBHOOK_TOKEN_DEV_SECRET = "lead-flow-studio-webhook-dev-secret";

/**
 * SPEC 10, W10 — `STUDIO_WEBHOOK_TOKEN_SECRET` é obrigatória em produção.
 * Os fallbacks para `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` saíram: eram
 * reuso de segredo entre domínios de segurança distintos (a chave de cifra
 * do token de webhook não pode depender do mesmo segredo que dá acesso
 * total ao banco). Fora de produção, mantém o segredo de desenvolvimento
 * fixo para não exigir configuração local.
 */
const resolveStudioWebhookTokenSecret = (): string | null => {
  const configuredSecret = process.env.STUDIO_WEBHOOK_TOKEN_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
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

/**
 * R10-11 (revisão Opus, decisão do owner) — antes do W10, `resolveStudioWebhookTokenSecret`
 * caía em `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` quando `STUDIO_WEBHOOK_TOKEN_SECRET`
 * não estava configurada. Se produção rodou algum tempo nesse fallback, tokens
 * já cifrados usam essas chaves — e decifrar só com o segredo obrigatório
 * novo os torna ilegíveis (o widget perde a URL completa, `getConfiguration`
 * cai no template) mesmo com a env nova setada corretamente daqui pra
 * frente. Estas chaves SÓ entram na LEITURA (decrypt), nunca na escrita
 * (encrypt sempre usa exclusivamente o segredo obrigatório) — e a
 * autenticação do webhook nunca depende delas, porque é feita pelo hash do
 * token (`safeStudioWebhookTokenEquals`), não pela cifra.
 */
const resolveLegacyStudioWebhookTokenCipherKeys = (): Buffer[] => {
  const legacySecrets = [process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), process.env.DATABASE_URL?.trim()].filter(
    (value): value is string => Boolean(value)
  );

  return legacySecrets.map((secret) => crypto.createHash("sha256").update(secret).digest());
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

const decryptStudioWebhookTokenWithKey = (
  key: Buffer,
  ivPart: string,
  authTagPart: string,
  encryptedPart: string
): string | null => {
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

export const decryptStudioWebhookToken = (tokenCipher: string | null | undefined): string | null => {
  if (!tokenCipher) {
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

  const primaryKey = resolveStudioWebhookTokenCipherKey();
  if (primaryKey) {
    const decrypted = decryptStudioWebhookTokenWithKey(primaryKey, ivPart, authTagPart, encryptedPart);
    if (decrypted !== null) {
      return decrypted;
    }
  }

  // R10-11: leitura só — tenta as chaves derivadas dos fallbacks
  // aposentados pelo W10, para não tornar ilegíveis tokens cifrados antes
  // da correção. A tag de autenticação do AES-GCM garante que uma chave
  // errada nunca "decifra" algo plausível por acaso — ou bate, ou falha.
  for (const legacyKey of resolveLegacyStudioWebhookTokenCipherKeys()) {
    const decrypted = decryptStudioWebhookTokenWithKey(legacyKey, ivPart, authTagPart, encryptedPart);
    if (decrypted !== null) {
      return decrypted;
    }
  }

  return null;
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

  return addMonths(now, 6);
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

export type WebhookMetadataShapeResult =
  | { ok: true }
  | { ok: false; reason: "too_deep" | "too_large" };

/** SPEC 10, DA6/A-E2 (T-10.8): teto de tamanho e profundidade do `metadata`
 * livre do payload. Roda ANTES do scan de SQLi e da gravação — sem isso,
 * aninhamento profundo (V9) estoura a pilha do scanner recursivo e vira 500
 * em vez de 400 controlado. Depth é calculado de forma iterativa (pilha
 * explícita, não recursão) para nunca estourar a própria pilha ao medir. */
const DEFAULT_MAX_METADATA_DEPTH = 3;
const DEFAULT_MAX_METADATA_BYTES = 8 * 1024;

const computeJsonDepthIterative = (value: unknown, stopAfterDepth: number): number => {
  type Frame = { value: unknown; depth: number };
  let maxSeen = 0;
  const stack: Frame[] = [{ value, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) continue;

    if (frame.depth > maxSeen) {
      maxSeen = frame.depth;
      if (maxSeen > stopAfterDepth) {
        return maxSeen;
      }
    }

    if (Array.isArray(frame.value)) {
      for (const item of frame.value) {
        stack.push({ value: item, depth: frame.depth + 1 });
      }
    } else if (frame.value && typeof frame.value === "object") {
      for (const key of Object.keys(frame.value as Record<string, unknown>)) {
        stack.push({ value: (frame.value as Record<string, unknown>)[key], depth: frame.depth + 1 });
      }
    }
  }

  return maxSeen;
};

export const evaluateWebhookMetadataShape = (
  metadata: unknown,
  options: { maxDepth?: number; maxBytes?: number } = {}
): WebhookMetadataShapeResult => {
  if (metadata === undefined || metadata === null) {
    return { ok: true };
  }

  const maxDepth = options.maxDepth ?? DEFAULT_MAX_METADATA_DEPTH;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_METADATA_BYTES;

  const depth = computeJsonDepthIterative(metadata, maxDepth + 1);
  if (depth > maxDepth) {
    return { ok: false, reason: "too_deep" };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(metadata) ?? "";
  } catch {
    return { ok: false, reason: "too_deep" };
  }

  if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  return { ok: true };
};

export const sanitizeStudioWebhookEndpointForLogs = (pathname: string, teamId: string): string => {
  const normalizedPath = pathname.split("?")[0];
  const tokenRoutePrefix = `/api/webhooks/studio/${teamId}/`;

  if (normalizedPath.startsWith(tokenRoutePrefix)) {
    return `${tokenRoutePrefix}[token]`;
  }

  return normalizedPath;
};
