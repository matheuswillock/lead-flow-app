import type { OutboundWebhookCreateState } from "./OutboundWebhookCreateTypes";

export function useOutboundWebhookCreate(supabaseId: string): OutboundWebhookCreateState {
  return { supabaseId };
}
