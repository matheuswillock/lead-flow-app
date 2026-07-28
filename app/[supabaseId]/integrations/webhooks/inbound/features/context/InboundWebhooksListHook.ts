import type { InboundWebhooksListState } from "./InboundWebhooksListTypes";

export function useInboundWebhooksList(supabaseId: string): InboundWebhooksListState {
  return { supabaseId };
}
