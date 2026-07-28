import type { OutboundWebhookDetailState } from "./OutboundWebhookDetailTypes";

export function useOutboundWebhookDetail(
  supabaseId: string,
  webhookId: string,
): OutboundWebhookDetailState {
  return { supabaseId, webhookId };
}
