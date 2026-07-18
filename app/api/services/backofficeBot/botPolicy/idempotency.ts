import { createHash } from "node:crypto";

const ACTION_IDEM_PREFIX = "bot-action:";

export function buildInboundIdempotencyKey(channelMessageId: string): string {
  return channelMessageId.trim();
}

export function buildActionIdempotencyKey(input: {
  userLinkId: string;
  action: string;
  teamId: string;
  canonicalParams: unknown;
  channelMessageId?: string | null;
}): string {
  if (input.channelMessageId?.trim()) {
    return `${ACTION_IDEM_PREFIX}${input.channelMessageId.trim()}:${input.action}`;
  }

  const canonical = stableStringify(input.canonicalParams);
  const digest = createHash("sha256")
    .update(
      [input.userLinkId, input.action, input.teamId, canonical].join("|"),
      "utf8"
    )
    .digest("hex")
    .slice(0, 32);

  return `${ACTION_IDEM_PREFIX}${digest}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export function isActionIdempotencyKey(key: string): boolean {
  return key.startsWith(ACTION_IDEM_PREFIX);
}
