const ACTION_IDEM_PREFIX = "bot-action:";

export function buildInboundIdempotencyKey(channelMessageId: string): string {
  return channelMessageId.trim();
}

export function buildActionIdempotencyKey(input: {
  userLinkId: string;
  action: string;
  teamId: string;
  channelMessageId?: string | null;
}): string | null {
  const channelMessageId = input.channelMessageId?.trim();
  return channelMessageId ? `${ACTION_IDEM_PREFIX}${channelMessageId}:${input.action}` : null;
}

export function isActionIdempotencyKey(key: string): boolean {
  return key.startsWith(ACTION_IDEM_PREFIX);
}
