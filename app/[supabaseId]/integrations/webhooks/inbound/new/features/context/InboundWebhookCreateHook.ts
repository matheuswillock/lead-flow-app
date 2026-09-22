import { useMemo } from "react";
import { inboundWebhookCreateService } from "../services/InboundWebhookCreateService";
import type { InboundWebhookCreateContextValue } from "./InboundWebhookCreateTypes";

export function useInboundWebhookCreateHook(supabaseId: string): InboundWebhookCreateContextValue {
  return useMemo(() => {
    const listPath = `/${supabaseId}/integrations/webhooks/inbound`;
    return {
      supabaseId,
      listPath,
      buildDetailPath: (webhookId: string) => `${listPath}/${webhookId}`,
      service: inboundWebhookCreateService,
    };
  }, [supabaseId]);
}
