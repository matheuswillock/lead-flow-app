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

/** Agent card fields persisted in BackofficeBotHostSettings (not .env.n8n). */
export const AGENT_HOST_SETTING_KEYS = ["agentBaseUrl", "desiredHostVersion"] as const;

/** Production Docker-network webhook used by Evolution → N8N. */
export const BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL =
  "http://n8n:5678/webhook/bethania-inbound" as const;

/** Public URLs for Ops quick-copy (browser / manager). */
export const OPS_HOST_REFERENCE_LINKS = [
  {
    id: "bethania-inbound-internal",
    label: "Webhook Evolution → N8N (rede Docker)",
    href: BETHANIA_INBOUND_WEBHOOK_INTERNAL_URL,
    hint: "Cole na instância bethania no manager Evolution. Não abre no navegador.",
  },
  {
    id: "bethania-inbound-public",
    label: "Webhook público (teste no browser)",
    href: "https://n8n.corretorstudio.com/webhook/bethania-inbound",
    hint: "Mesmo path, host público. GET pode falhar; o fluxo real é POST da Evolution.",
  },
  {
    id: "n8n-editor",
    label: "Editor N8N",
    href: "https://n8n.corretorstudio.com",
    hint: null,
  },
  {
    id: "evolution-manager",
    label: "Evolution manager",
    href: "https://evo.corretorstudio.com/manager",
    hint: null,
  },
  {
    id: "ops-agent",
    label: "Agente Ops (healthz)",
    href: "https://ops.corretorstudio.com/healthz",
    hint: null,
  },
] as const;

export const SECRET_HOST_ENV_KEYS = new Set<string>([
  "BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET",
  "EVO_API_KEY",
  "AUTHENTICATION_API_KEY",
  "BETHANIA_SLACK_WEBHOOK_URL",
]);

export type N8nHostEnvKey = (typeof N8N_HOST_ENV_KEYS)[number];
export type EvolutionHostEnvKey = (typeof EVOLUTION_HOST_ENV_KEYS)[number];
export type AgentHostSettingKey = (typeof AGENT_HOST_SETTING_KEYS)[number];

export type MaskedEnvField = {
  key: string;
  isSet: boolean;
  isSecret: boolean;
  value: string | null;
};

export type OpsHostAgentSettings = {
  agentBaseUrl: string | null;
  desiredHostVersion: string | null;
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

/** Ordered KEY=value lines for allowlisted keys (empty values omitted). */
export function envMapToOrderedLines(
  env: Record<string, string>,
  keys: readonly string[]
): string[] {
  return keys
    .map((key) => {
      const value = env[key]?.trim() ?? "";
      return value ? `${key}=${value}` : null;
    })
    .filter((line): line is string => Boolean(line));
}

/** Combined Ops export (.txt) with Agent + N8N + Evolution sections. */
export function buildOpsHostEnvFileContent(input: {
  agent?: OpsHostAgentSettings;
  n8nEnv: Record<string, string>;
  evolutionEnv: Record<string, string>;
}): string {
  const agentMap: Record<string, string> = {
    agentBaseUrl: input.agent?.agentBaseUrl?.trim() || "",
    desiredHostVersion: input.agent?.desiredHostVersion?.trim() || "",
  };
  const agentLines = envMapToOrderedLines(agentMap, AGENT_HOST_SETTING_KEYS);
  const n8nLines = envMapToOrderedLines(input.n8nEnv, N8N_HOST_ENV_KEYS);
  const evoLines = envMapToOrderedLines(input.evolutionEnv, EVOLUTION_HOST_ENV_KEYS);
  return [
    "# Bethânia Ops / Host — Agente VPS",
    ...agentLines,
    "",
    "# Bethânia Ops / Host — variáveis N8N",
    ...n8nLines,
    "",
    "# Bethânia Ops / Host — variáveis Evolution",
    ...evoLines,
    "",
  ].join("\n");
}

/** Split a combined/ops .env file into agent settings + allowlisted env maps. */
export function parseOpsHostEnvFileContent(content: string): {
  agent: OpsHostAgentSettings;
  n8nEnv: Record<string, string>;
  evolutionEnv: Record<string, string>;
} {
  const parsed = parseEnvFileContent(content);
  const agentRaw = filterAllowedEnv(parsed, AGENT_HOST_SETTING_KEYS);
  return {
    agent: {
      agentBaseUrl: agentRaw.agentBaseUrl?.trim() || null,
      desiredHostVersion: agentRaw.desiredHostVersion?.trim() || null,
    },
    n8nEnv: filterAllowedEnv(parsed, N8N_HOST_ENV_KEYS),
    evolutionEnv: filterAllowedEnv(parsed, EVOLUTION_HOST_ENV_KEYS),
  };
}
