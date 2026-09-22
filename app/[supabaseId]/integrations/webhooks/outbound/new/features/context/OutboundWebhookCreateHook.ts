import { useMemo } from "react";
import { outboundWebhookCreateService } from "../services/OutboundWebhookCreateService";
import type { OutboundWebhookCreateContextValue } from "./OutboundWebhookCreateTypes";

export function useOutboundWebhookCreateHook(supabaseId: string): OutboundWebhookCreateContextValue {
  return useMemo(() => {
    const listPath = `/${supabaseId}/integrations/webhooks/outbound`;
    return {
      supabaseId,
      listPath,
      buildDetailPath: (webhookId: string) => `${listPath}/${webhookId}`,
      service: outboundWebhookCreateService,
    };
  }, [supabaseId]);
}
