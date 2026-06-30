export type BotMessageType =
  | "text"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "sticker"
  | "location";

export type BotMessageLinkPreview = {
  title?: string;
  description?: string;
  imageUrl?: string;
  url?: string;
};

export type BotMessagePayload = {
  messageType: BotMessageType;
  contentText?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  mediaFileName?: string | null;
  linkPreview?: BotMessageLinkPreview | null;
  pushName?: string | null;
};

export type StudioBotInboundWebhookBody = {
  normalizedPhone: string;
  channelMessageId?: string;
  payload: BotMessagePayload;
};

export type StudioBotActionWebhookBody = {
  normalizedPhone: string;
  action: string;
  params?: Record<string, unknown>;
  userLinkId?: string;
};

export type StudioBotEventOutboxPayload = {
  eventType: string;
  profileId: string;
  normalizedPhone: string;
  leadId?: string;
  leadCode?: string;
  leadName?: string;
  message: string;
  actionButtons: Array<{ id: string; label: string; payload: object }>;
  deepLink: string;
};
