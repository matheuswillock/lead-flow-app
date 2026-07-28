import type { OutboundWebhooksListState } from "./OutboundWebhooksListTypes";

export function useOutboundWebhooksList(supabaseId: string): OutboundWebhooksListState {
  return { supabaseId };
}
