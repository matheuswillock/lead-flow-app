import type { InboundWebhookDetailState } from "./InboundWebhookDetailTypes";

export function useInboundWebhookDetail(
  supabaseId: string,
  webhookId: string,
): InboundWebhookDetailState {
  return { supabaseId, webhookId };
}
