export const N8N_HOST_ENV_KEYS = [
  "LEAD_FLOW_API_BASE_URL",
  "N8N_WEBHOOK_BASE_URL",
  "BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET",
  "EVO_API_BASE_URL",
  "EVO_API_KEY",
  "EVO_BETHANIA_INSTANCE",
  "BACKOFFICE_BETHANIA_WHATSAPP_NUMBER",
  "N8N_BLOCK_ENV_ACCESS_IN_NODE",
  "NODE_FUNCTION_ALLOW_BUILTIN",
  "N8N_RUNNERS_ENABLED",
  "BETHANIA_SLACK_WEBHOOK_URL",
] as const;

export const EVOLUTION_HOST_ENV_KEYS = [
  "AUTHENTICATION_API_KEY",
  "CONFIG_SESSION_PHONE_VERSION",
] as const;

export const SECRET_HOST_ENV_KEYS = new Set<string>([
  "BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET",
  "EVO_API_KEY",
  "AUTHENTICATION_API_KEY",
  "BETHANIA_SLACK_WEBHOOK_URL",
]);

export type N8nHostEnvKey = (typeof N8N_HOST_ENV_KEYS)[number];
export type EvolutionHostEnvKey = (typeof EVOLUTION_HOST_ENV_KEYS)[number];

export type MaskedEnvField = {
  key: string;
  isSet: boolean;
  isSecret: boolean;
  value: string | null;
};

export function filterAllowedEnv(
  input: Record<string, string | undefined | null>,
  allowlist: readonly string[]
): Record<string, string> {
  const allowed = new Set(allowlist);
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    out[key] = value;
  }
  return out;
}

export function mergeEnvMaps(
  current: Record<string, string>,
  patch: Record<string, string>
): Record<string, string> {
  return { ...current, ...patch };
}

export function maskEnvMap(env: Record<string, string>): MaskedEnvField[] {
  return Object.keys(env)
    .sort()
    .map((key) => {
      const isSecret = SECRET_HOST_ENV_KEYS.has(key);
      const value = env[key] ?? "";
      return {
        key,
        isSet: value.length > 0,
        isSecret,
        value: isSecret ? null : value || null,
      };
    });
}

export function toEnvFileContent(env: Record<string, string>): string {
  return Object.entries(env)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
    .concat("\n");
}

export function parseEnvFileContent(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}
