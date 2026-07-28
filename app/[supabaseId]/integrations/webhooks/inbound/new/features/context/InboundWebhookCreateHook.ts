import type { InboundWebhookCreateState } from "./InboundWebhookCreateTypes";

export function useInboundWebhookCreate(supabaseId: string): InboundWebhookCreateState {
  return { supabaseId };
}
